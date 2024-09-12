import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleGenerativeAIStream, StreamingTextResponse } from 'ai';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { CharacterTextSplitter } from 'langchain/text_splitter';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Initialize the Google Generative AI with the appropriate key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Initialize embeddings
const embeddings = new GoogleGenerativeAIEmbeddings({
  modelName: 'embedding-001',
  apiKey: process.env.GEMINI_API_KEY,
});

// Load and process the PDF
async function loadAndProcessPDF() {
  try {
    const loader = new PDFLoader('public/gg.pdf');
    const docs = await loader.load();
    const splitter = new CharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const splitDocs = await splitter.splitDocuments(docs);
    return await MemoryVectorStore.fromDocuments(splitDocs, embeddings);
  } catch (error) {
    console.error('Error loading and processing PDF:', error);
    return null;
  }
}

// Load the vector store once when the server starts
let vectorStore: MemoryVectorStore | null = null;
loadAndProcessPDF()
  .then((vs) => {
    vectorStore = vs;
    console.log('PDF processed and vector store created');
  })
  .catch((error) => {
    console.error('Failed to create vector store:', error);
  });

// Function to perform web search
async function webSearch(query: string): Promise<string> {
  try {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });
    const $ = cheerio.load(response.data);
    const searchResults = $('.g')
      .map((i, el) => {
        const title = $(el).find('.r').text();
        const snippet = $(el).find('.s').text();
        return `${title}\n${snippet}`;
      })
      .get()
      .join('\n\n');
    return searchResults.slice(0, 1000); // Limit to first 1000 characters
  } catch (error) {
    console.error('Error performing web search:', error);
    return '';
  }
}

// Function to fetch Wikipedia summary
async function wikipediaSearch(query: string): Promise<string> {
  try {
    const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    const response = await axios.get(apiUrl);
    return response.data.extract || '';
  } catch (error) {
    console.error('Error fetching Wikipedia summary:', error);
    return '';
  }
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1];

    let context = '';
    if (vectorStore) {
      const relevantDocs = await vectorStore.similaritySearch(lastMessage.content, 3);
      context = relevantDocs.map((doc) => doc.pageContent).join('\n');
    }

    // If no relevant context found in PDF, try web search and Wikipedia
    if (!context) {
      const webResults = await webSearch(`Mangalore ${lastMessage.content}`);
      const wikiResults = await wikipediaSearch('Mangalore');
      context = `Web Search Results:\n${webResults}\n\nWikipedia Summary:\n${wikiResults}`;
    }

    const greeting = 'Hello! How can I assist you today?';

    const prompt = `${greeting} You are an AI assistant specialized in providing information about Mangalore city. Use the following context to answer the user's question. If the context is from web search or Wikipedia, make it clear that this information is from external sources and might not be as specific to the PDF content.

Context: ${context ? context : 'No relevant information found.'}

User's question: ${lastMessage.content}

Please provide a helpful and informative response:`;

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const formattedHistory = messages.slice(0, -1).map((m: { role: string; content: any }) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({
      history: formattedHistory,
    });

    const result = await chat.sendMessageStream([{ text: prompt }]);
    const stream = GoogleGenerativeAIStream(result);

    return new StreamingTextResponse(stream);
  } catch (error) {
    console.error('Error handling request:', error);
    return new Response('Something went wrong', { status: 500 });
  }
}

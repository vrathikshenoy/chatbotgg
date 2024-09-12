'use client'

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useChat } from "ai/react";
import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // Import Framer Motion

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: 'api/chat',
    onError: (e) => {
      console.log(e);
    },
  });

  const chatParent = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const domNode = chatParent.current;
    if (domNode) {
      domNode.scrollTop = domNode.scrollHeight;
    }
  }, [messages]);

  return (
    <main className="flex flex-col w-full h-screen max-h-dvh bg-background">

      <header className="p-4 border-b w-full max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-center">Chat</h1>
      </header>

      <section className="p-4">
        <form onSubmit={handleSubmit} className="flex w-full max-w-3xl mx-auto items-center gap-2">
          <Input
            className="flex-1 min-h-[40px] p-2 border border-gray-300 rounded-md"
            placeholder="Type your question here..."
            type="text"
            value={input}
            onChange={handleInputChange}
          />
          <Button className="ml-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400" type="submit">
            Submit
          </Button>
        </form>
      </section>

      <section className="container px-0 pb-10 flex flex-col flex-grow gap-4 mx-auto max-w-3xl">
        <ul ref={chatParent} className="p-4 flex-grow bg-muted/50 rounded-lg overflow-y-auto flex flex-col gap-4">
          <AnimatePresence>
            {messages.map((m, index) => (
              <motion.li
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className={`flex ${m.role === 'user' ? 'flex-row' : 'flex-row-reverse'}`}
              >
                <div className={`rounded-xl p-4 shadow-md flex ${m.role === 'user' ? 'bg-blue-100' : 'bg-gray-100'} w-3/4`}>
                  <p className="text-gray-800">{m.content}</p>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </section>
    </main>
  );
}

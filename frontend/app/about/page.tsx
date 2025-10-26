"use client";
import Header from "../components/Header";

// app/about/page.tsx
export default function About() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900 overflow-x-hidden overflow-y-auto transition-colors">
    <Header/>
     <section className="flex flex-col items-center pt-12 bg-white dark:bg-gray-900 transition-colors px-5 ">
      <div className="max-w-3xl text-center">
        {/* Header */}
        <h1 className="text-3xl font-extrabold text-red-600 dark:text-red-500 mb-6 tracking-tight">
          About ComfTalk
        </h1>

        {/* Description */}
        <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed mb-8 text-justify">
          The <span className="font-semibold text-red-600 dark:text-red-400">AI Accent Training Platform </span> 
          is an intelligent, web-based application engineered to help 
          non-native English speakers enhance their pronunciation, rhythm, and fluency. 
          Through advanced <span className="font-medium">AI-driven speech recognition </span> and 
          <span className="font-medium"> feedback analytics</span>, users can engage in realistic 
          speaking sessions and receive real-time evaluations of their vocal clarity and tone.
        </p>

        {/* Vision & Relevance */}
        <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed mb-8 text-justify">
          The platform addresses the growing demand for personalized English-speaking 
          support in globalized communication contexts — from academic interviews to 
          multinational workplaces. By focusing on spoken interaction instead of 
          traditional grammar-centric learning, the system aims to
          <span className="text-red-600 dark:text-red-400 font-medium"> bridge the gap between accuracy and authenticity in speech
          </span>.
        </p>

        {/* Research & Objective Context */}
        <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed text-justify">
          Developed as part of an academic research initiative in 
          <span className="font-medium text-red-500 dark:text-red-400"> AI-enhanced language learning</span>, 
          this project integrates speech-to-text algorithms, accent evaluation models, 
          and sentiment calibration systems. Its core objective is to 
          <span className="font-medium text-red-600 dark:text-red-400"> empower learners to practice extended monologues and accent training 
          independently</span>, with measurable progress indicators and adaptive topic suggestions.
        </p>
      </div>
    </section>
    </div>
  );
}

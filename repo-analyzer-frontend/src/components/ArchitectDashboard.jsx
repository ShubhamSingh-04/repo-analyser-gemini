import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from 'react-markdown';

export default function ArchitectDashboard() {
    const [repoUrl, setRepoUrl] = useState('');
    const [branch, setBranch] = useState('main');

    // UI States
    const [isLoadingTree, setIsLoadingTree] = useState(false);
    const [isLoadingCode, setIsLoadingCode] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [activeTab, setActiveTab] = useState('code');

    // NEW Data States for File Explorer
    const [rawTree, setRawTree] = useState([]); // Stores everything
    const [currentPath, setCurrentPath] = useState(''); // Tracks current folder ('', 'src', 'src/main', etc.)
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileCode, setFileCode] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatting, setIsChatting] = useState(false);

    // 2. HELPER FUNCTIONS
    const getLanguage = (filePath) => {
        if (!filePath) return 'text';
        if (filePath.endsWith('.java')) return 'java';
        if (filePath.endsWith('.xml') || filePath.includes('pom.xml')) return 'xml';
        if (filePath.endsWith('.md')) return 'markdown';
        if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) return 'javascript';
        return 'text';
    };

    // Helper: Find items only in the current directory
    const getVisibleItems = () => {
        return rawTree.filter(item => {
            if (currentPath === '') {
                // If at root, show items with NO slashes in their path
                return !item.path.includes('/');
            }
            // If in a folder, show items that start with that folder path...
            const prefix = currentPath + '/';
            if (item.path.startsWith(prefix)) {
                // ...but don't have any deeper slashes
                const remaining = item.path.substring(prefix.length);
                return !remaining.includes('/');
            }
            return false;
        }).sort((a, b) => {
            // Sort folders to the top, files to the bottom
            if (a.type === b.type) return a.path.localeCompare(b.path);
            return a.type === 'tree' ? -1 : 1;
        });
    };

    // Helper: Go up one folder level
    const navigateUp = () => {
        if (currentPath === '') return;
        const parts = currentPath.split('/');
        parts.pop(); // Remove the last folder
        setCurrentPath(parts.join('/'));
    };

    // 3. API WORKFLOWS

    // A. Fetch the whole repository map
    const handleFetchTree = async (e) => {
        e.preventDefault();
        if (!repoUrl) return alert("Please enter a GitHub URL!");

        setIsLoadingTree(true);
        setRawTree([]);
        setCurrentPath(''); // Reset to root folder
        setSelectedFile(null);
        setChatHistory([]);
        setFileCode('');

        try {
            const response = await fetch(`http://localhost:8080/api/tree?repoUrl=${encodeURIComponent(repoUrl)}&branch=${encodeURIComponent(branch)}`);
            if (!response.ok) throw new Error("Failed to fetch tree");
            const data = await response.json();

            // Save the raw array exactly as GitHub sends it (files AND folders)
            setRawTree(data.tree);
        } catch (error) {
            alert("Failed to load repo. Check terminal for 404 or rate limits.");
        } finally {
            setIsLoadingTree(false);
        }
    };

    // B. User clicks a file -> Fetch code instantly
    const handleFileSelect = async (filePath) => {
        setSelectedFile(filePath);
        setActiveTab('code'); // Force tab to code view
        setChatHistory([]);
        setFileCode('');      // Clear old code
        setIsLoadingCode(true);

        try {
            const response = await fetch(`http://localhost:8080/api/file?repoUrl=${encodeURIComponent(repoUrl)}&path=${encodeURIComponent(filePath)}&branch=${encodeURIComponent(branch)}`);
            const data = await response.json();
            setFileCode(data.code);
        } catch (error) {
            setFileCode("// Error loading source code");
        } finally {
            setIsLoadingCode(false);
        }
    };

    // 1. Initial Deep Dive (Starts the conversation)
    const handleTriggerAnalysis = async () => {
        setIsAnalyzing(true);
        setActiveTab('analysis');
        setChatHistory([]); // Clear old chats

        try {
            const response = await fetch(`http://localhost:8080/api/analyze-file?repoUrl=${encodeURIComponent(repoUrl)}&path=${encodeURIComponent(selectedFile)}&branch=${encodeURIComponent(branch)}`);
            const data = await response.json();

            // Add the first AI message to the history
            setChatHistory([{ role: 'ai', content: data.explanation }]);
        } catch (error) {
            setChatHistory([{ role: 'ai', content: "⚠️ Failed to generate initial analysis." }]);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // 2. Continuous Chat (Follow-up questions)
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!chatInput.trim() || isChatting) return;

        const userMessage = chatInput.trim();
        setChatInput(''); // Clear input box immediately

        // Add user message to UI
        setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsChatting(true);

        try {
            // Note: To make this perfect, your Spring Boot backend will need a new 
            // /api/chat endpoint that accepts the prompt AND the file code!
            const response = await fetch(`http://localhost:8080/api/chat-file?repoUrl=${encodeURIComponent(repoUrl)}&path=${encodeURIComponent(selectedFile)}&branch=${encodeURIComponent(branch)}&prompt=${encodeURIComponent(userMessage)}`);
            const data = await response.json();

            // Add AI response to UI
            setChatHistory(prev => [...prev, { role: 'ai', content: data.explanation }]);
        } catch (error) {
            setChatHistory(prev => [...prev, { role: 'ai', content: "⚠️ Failed to get response." }]);
        } finally {
            setIsChatting(false);
        }
    };

    // 4. RENDER
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* --- Header & Search --- */}
                <header className="flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg">
                    <div>
                        <h1 className="text-2xl font-extrabold text-blue-500 tracking-tight">Repo-Insight IDE</h1>
                        <p className="text-slate-400 text-sm">File Explorer & AI</p>
                    </div>

                    <form onSubmit={handleFetchTree} className="flex flex-1 max-w-2xl gap-3 w-full">
                        <input
                            type="text"
                            value={repoUrl}
                            onChange={(e) => setRepoUrl(e.target.value)}
                            placeholder="https://github.com/owner/repo"
                            className="flex-[3] bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 text-sm"
                        />
                        <div className="flex-[1] relative">
                            <span className="absolute left-3 top-2.5 text-slate-500 text-xs font-mono">branch:</span>
                            <input
                                type="text"
                                value={branch}
                                onChange={(e) => setBranch(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-16 pr-3 py-2 focus:outline-none focus:border-blue-500 font-mono text-sm"
                            />
                        </div>
                        <button disabled={isLoadingTree} className="bg-blue-600 px-6 py-2 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 text-sm whitespace-nowrap">
                            {isLoadingTree ? "Fetching..." : "Load Repo"}
                        </button>
                    </form>
                </header>

                {/* --- Main Workspace --- */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[750px]">

                    {/* LEFT: FILE EXPLORER (3 Columns) */}
                    {/* LEFT: FILE EXPLORER (3 Columns) */}
                    <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden">

                        {/* Explorer Header */}
                        <div className="bg-slate-950/50 p-3 border-b border-slate-800 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Explorer</span>
                        </div>

                        {/* Breadcrumbs & Navigation */}
                        {rawTree.length > 0 && (
                            <div className="bg-slate-900 p-2 border-b border-slate-800 flex items-center gap-2">
                                <button
                                    onClick={navigateUp}
                                    disabled={currentPath === ''}
                                    className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded disabled:opacity-30 transition-colors"
                                    title="Go back"
                                >
                                    ⬅️
                                </button>
                                <span className="font-mono text-xs text-blue-400 truncate flex-1">
                                    /{currentPath}
                                </span>
                            </div>
                        )}

                        {/* Directory List */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                            {rawTree.length === 0 && !isLoadingTree && (
                                <p className="text-xs text-slate-500 text-center mt-10">No repository loaded.</p>
                            )}

                            {getVisibleItems().map((item, i) => {
                                const isFolder = item.type === 'tree';
                                const itemName = item.path.split('/').pop();

                                return (
                                    <button
                                        key={i}
                                        onClick={() => isFolder ? setCurrentPath(item.path) : handleFileSelect(item.path)}
                                        className={`w-full text-left px-3 py-2 rounded font-mono text-xs truncate transition-colors flex items-center gap-2 ${selectedFile === item.path
                                            ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                                            }`}
                                    >
                                        <span className="text-sm">{isFolder ? '📁' : '📄'}</span>
                                        <span>{itemName}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* RIGHT: EDITOR & ANALYSIS (9 Columns) */}
                    <div className="lg:col-span-9 bg-[#0d1117] border border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-2xl">

                        {/* Tab Bar */}
                        <div className="flex bg-[#010409] border-b border-slate-800">
                            <button
                                onClick={() => setActiveTab('code')}
                                disabled={!selectedFile}
                                className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'code' ? 'border-blue-500 text-blue-400 bg-[#0d1117]' : 'border-transparent text-slate-500 hover:bg-slate-900'
                                    }`}
                            >
                                Source Code
                            </button>
                            <button
                                onClick={() => setActiveTab('analysis')}
                                disabled={!selectedFile}
                                className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'analysis' ? 'border-purple-500 text-purple-400 bg-[#0d1117]' : 'border-transparent text-slate-500 hover:bg-slate-900'
                                    }`}
                            >
                                AI Analysis
                            </button>
                        </div>

                        {/* File Path Header */}
                        {selectedFile && (
                            <div className="px-4 py-2 bg-[#0d1117] border-b border-slate-800 flex justify-between items-center">
                                <span className="font-mono text-xs text-slate-400">{selectedFile}</span>
                                {activeTab === 'code' && (
                                    <button
                                        onClick={handleTriggerAnalysis}
                                        // FIX: Use chatHistory.length to check if we already analyzed
                                        disabled={isAnalyzing || chatHistory.length > 0}
                                        className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/50 px-3 py-1 rounded text-xs font-bold transition-colors disabled:opacity-50"
                                    >
                                        {isAnalyzing ? "Analyzing..." : chatHistory.length > 0 ? "Analysis Complete" : "✨ Ask Gemini"}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto">
                            {!selectedFile && (
                                <div className="h-full flex flex-col items-center justify-center text-slate-600">
                                    <span className="text-4xl mb-4">📂</span>
                                    <p>Select a file from the explorer to view code.</p>
                                </div>
                            )}

                            {/* SOURCE CODE TAB */}
                            {selectedFile && activeTab === 'code' && (
                                <div className="h-full">
                                    {isLoadingCode ? (
                                        <div className="p-6 animate-pulse text-slate-500 text-sm font-mono">Fetching source code...</div>
                                    ) : (
                                        <SyntaxHighlighter
                                            language={getLanguage(selectedFile)}
                                            style={vscDarkPlus}
                                            showLineNumbers={true}
                                            customStyle={{
                                                margin: 0,
                                                padding: '1.5rem',
                                                fontSize: '0.85rem',
                                                backgroundColor: 'transparent',
                                                height: '100%'
                                            }}
                                        >
                                            {fileCode}
                                        </SyntaxHighlighter>
                                    )}
                                </div>
                            )}

                            {/* ANALYSIS & CHAT TAB */}
                            {selectedFile && activeTab === 'analysis' && (
                                <div className="flex flex-col h-full bg-[#0d1117]">

                                    {/* 1. Scrollable Chat History */}
                                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                                        {chatHistory.length === 0 && !isAnalyzing ? (
                                            <div className="text-center text-slate-500 mt-20">
                                                <div className="text-4xl mb-4">🤖</div>
                                                <p className="mb-4">No analysis generated yet.</p>
                                                <button onClick={handleTriggerAnalysis} className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-purple-700 transition-colors">
                                                    Generate Initial Breakdown
                                                </button>
                                            </div>
                                        ) : (
                                            chatHistory.map((msg, index) => (
                                                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                    <div className={`max-w-[85%] p-5 rounded-2xl ${msg.role === 'user'
                                                        ? 'bg-blue-600 text-white rounded-br-none shadow-md'
                                                        : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-none shadow-lg'
                                                        }`}>
                                                        {msg.role === 'ai' ? (
                                                            <div className="prose prose-invert prose-sm max-w-none prose-headings:text-purple-400 prose-headings:font-bold prose-strong:text-purple-300 prose-ul:border-l-2 prose-ul:border-slate-700 prose-ul:pl-4 prose-li:marker:text-purple-500">
                                                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                                                            </div>
                                                        ) : (
                                                            <p className="text-sm">{msg.content}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}

                                        {/* Loading Indicators */}
                                        {(isAnalyzing || isChatting) && (
                                            <div className="flex justify-start">
                                                <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl rounded-bl-none max-w-[85%]">
                                                    <div className="animate-pulse flex space-x-2">
                                                        <div className="h-2 w-2 bg-purple-500 rounded-full"></div>
                                                        <div className="h-2 w-2 bg-purple-500 rounded-full delay-75"></div>
                                                        <div className="h-2 w-2 bg-purple-500 rounded-full delay-150"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* 2. Sticky Input Box */}
                                    {chatHistory.length > 0 && (
                                        <form onSubmit={handleSendMessage} className="p-4 bg-slate-900 border-t border-slate-800 flex gap-3">
                                            <input
                                                type="text"
                                                value={chatInput}
                                                onChange={(e) => setChatInput(e.target.value)}
                                                placeholder="Ask a follow-up question about this code..."
                                                disabled={isChatting}
                                                className="flex-1 bg-[#010409] border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-50"
                                            />
                                            <button
                                                type="submit"
                                                disabled={!chatInput.trim() || isChatting}
                                                className="bg-purple-600 px-6 py-3 rounded-xl font-bold hover:bg-purple-700 disabled:bg-slate-800 disabled:text-slate-500 transition-all shadow-lg"
                                            >
                                                Send
                                            </button>
                                        </form>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
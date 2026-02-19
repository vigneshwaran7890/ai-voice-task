'use client';
import { useState, useEffect, useRef } from 'react';

export default function VoiceTaskCreator() {
  const [listening, setListening] = useState(false);
  const [speechText, setSpeechText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    assignTo: '',
    startDate: '',
    endDate: '',
  });
  const [userOptions, setUserOptions] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recognitionAvailable, setRecognitionAvailable] = useState(true);
  const [messages, setMessages] = useState([
    { text: "Hi! I'm your voice task assistant. Click the mic and tell me what task you'd like to create.", type: 'bot' }
  ]);

  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognitionClass =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      const recognition = new SpeechRecognitionClass();
      recognition.lang = 'en-US';
      recognition.interimResults = true;
      recognition.continuous = false;

      recognitionRef.current = recognition;

      let finalTranscript = '';

      recognition.onresult = (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
            setSpeechText(finalTranscript);
            setInterimText('');
          } else {
            interimTranscript += transcript;
            setInterimText(interimTranscript);
          }
        }
      };

      recognition.onstart = () => {
        setMessages(prev => [...prev, { text: "Listening...", type: 'bot' }]);
      };

      recognition.onend = async () => {
        if (finalTranscript) {
          setMessages(prev => [...prev, { text: finalTranscript, type: 'user' }]);
          setIsLoading(true);
          await sendToGemini(finalTranscript);
          setIsLoading(false);
        } else if (!interimText) {
          setMessages(prev => [...prev, { text: "I didn't catch that. Could you try again?", type: 'bot' }]);
        }
        setListening(false);
          setInterimText('');

      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setMessages(prev => [...prev, { text: `Error: ${event.error}`, type: 'error' }]);
        setListening(false);
        setIsLoading(false);
        if (event.error === 'not-allowed') {
          setMessages(prev => [...prev, { text: "Microphone access denied. Please enable microphone permissions.", type: 'error' }]);
        }
      };
    } else {
      setRecognitionAvailable(false);
      setMessages(prev => [...prev, { text: "Speech recognition not supported in your browser", type: 'error' }]);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);


  // test

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const toggleListening = () => {
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      setSpeechText('');
      setInterimText('');
      setListening(true);
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error('Error starting recognition:', err);
        setListening(false);
        setMessages(prev => [...prev, { text: 'Error: Could not start microphone', type: 'error' }]);
      }
    }
  };

  const sendToGemini = async (text, email = null) => {
    try {
      setIsLoading(true);
      setMessages(prev => [...prev, { text: "Processing your request...", type: 'bot' }]);
      
      const res = await fetch('http://localhost:5000/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(email ? { text, email } : { text }),
      });

      if(res.status !== 200) {
        setMessages(prev => [...prev, { text: '⚠️ Please provide a valid task description.', type: 'error' }]);
        setIsLoading(false);
        return;
      }

      const data = await res.json();

      if (data.ambiguous) {
        setUserOptions(data.ambiguous);
        setShowPopup(true);
        setMessages(prev => [...prev, { text: "I found multiple possible users. Please select the correct ones.", type: 'bot' }]);
      } else {
        setFormData({
          title: data.taskName || '',
          assignTo: data.assignTo || '',
          startDate: data.startDate || '',
          endDate: data.endDate || '',
        });
        
        let responseText = `Task created: "${data.taskName}"`;
        if (data.assignTo) {
          responseText += `\nAssigned to: ${data.assignTo.map(u => u.name).join(', ')}`;
        }
        if (data.startDate || data.endDate) {
          responseText += `\nDates: ${formatDate(data.startDate)} to ${formatDate(data.endDate)}`;
        }
        
        setMessages(prev => [...prev, { text: responseText, type: 'bot' }]);
      }
    } catch (error) {
      console.error('Error parsing with Gemini:', error);
      setMessages(prev => [...prev, { text: '⚠️ Error processing your request. Please try again.', type: 'error' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSelection = async () => {
    if (selectedEmails.length === 0) return;
    setIsLoading(true);
    setShowPopup(false);
    setMessages(prev => [...prev, { text: `Selected users: ${selectedEmails.join(', ')}`, type: 'user' }]);
    await sendToGemini(speechText, selectedEmails);
    setSelectedEmails([]);
    setIsLoading(false);
  };

  const handleUserClick = (email) => {
    setSelectedEmails(prev =>
      prev.includes(email)
        ? prev.filter(e => e !== email)
        : [...prev, email]
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-md overflow-hidden">
        <div className="bg-indigo-600 p-6 text-white">
          <h1 className="text-2xl font-bold">Voice Task Creator</h1>
          <p className="mt-2 text-indigo-200">
            Speak naturally to create tasks
          </p>
        </div>

        <div className="p-6">
          {/* Chat-style message container */}
          <div className="h-96 overflow-y-auto mb-4 border rounded-lg bg-gray-50 p-4">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs md:max-w-md rounded-lg px-4 py-2 ${message.type === 'user'
                      ? 'bg-indigo-500 text-white'
                      : message.type === 'error'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-200 text-gray-800'
                      }`}
                  >
                    {message.text.split('\n').map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                </div>
              ))}
              {interimText && (
                <div className="flex justify-end">
                  <div className="max-w-xs md:max-w-md rounded-lg px-4 py-2 bg-indigo-100 text-indigo-800 italic">
                    {interimText}
                  </div>
                </div>
              )}
              {isLoading && !interimText && (
                <div className="flex justify-start">
                  <div className="max-w-xs md:max-w-md rounded-lg px-4 py-2 bg-gray-200 text-gray-800">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce"></div>
                      <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="flex flex-col items-center py-4">
            <button
              onClick={toggleListening}
              disabled={!recognitionAvailable || isLoading}
              className={`h-16 w-16 rounded-full flex items-center justify-center transition-all ${listening
                ? 'bg-red-500 animate-pulse'
                : 'bg-indigo-500 hover:bg-indigo-600'
                } ${(!recognitionAvailable || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {listening ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>
            <div className="mt-2 text-sm text-gray-500">
              {listening ? 'Listening...' : 'Tap to speak'}
            </div>
          </div>
        </div>
      </div>

      {showPopup && (
        <div className="fixed inset-0 bg-transparent bg-opacity-40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-sm">
            <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
              <h2 className="font-bold">Select Users</h2>
              <button onClick={() => setShowPopup(false)} className="text-indigo-200">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
              </button>
            </div>

            <div className="p-4 max-h-[50vh] overflow-y-auto">
              <p className="text-sm text-gray-600 mb-3">
          Multiple users found. Please select the correct ones:
              </p>

              <ul className="space-y-2">
          {userOptions.map((group, i) => (
            group.options.map(user => (
              <li key={user.id}>
                <button
            onClick={() => handleUserClick(user.email)}
            className={`w-full text-left p-2 rounded border text-sm flex items-center ${selectedEmails.includes(user.email)
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-200 hover:bg-gray-50'
              }`}
                >
            <span className={`inline-block h-3 w-3 rounded-full mr-2 ${selectedEmails.includes(user.email) ? 'bg-indigo-500' : 'bg-gray-200'}`}></span>
            <div>
              <div className="font-medium">{user.name}</div>
              <div className="text-gray-500">{user.email}</div>
            </div>
                </button>
              </li>
            ))
          ))}
              </ul>
            </div>

            <div className="flex justify-between p-3 border-t">
              <button
          onClick={() => setShowPopup(false)}
          className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
              >
          Cancel
              </button>
              <button
          onClick={handleConfirmSelection}
          disabled={selectedEmails.length === 0}
          className={`px-3 py-1 rounded text-sm ${selectedEmails.length > 0
            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
              >
          Confirm {selectedEmails.length > 0 && `(${selectedEmails.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
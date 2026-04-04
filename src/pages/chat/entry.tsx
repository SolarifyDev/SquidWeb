import React, { useState } from 'react'
import { Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useSpace } from 'contexts/SpaceContext'

const chatTypes = [{ key: 'OpenClaw', label: 'OpenClaw' }]

const openClawOptions = [
  {
    key: 'openclaw-chat',
    title: 'OpenClaw Chat',
    desc: 'Chat with OpenClaw targets by tags and receive responses from multiple targets.',
    recommended: true,
  },
]

const ChatEntryPage: React.FC = () => {
  const navigate = useNavigate()
  const { space } = useSpace()
  const [selectedChatType, setSelectedChatType] = useState('OpenClaw')
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-[1600px] mx-auto px-8 pt-4 pb-10">
        <div className="border border-gray-200 rounded-md bg-white overflow-hidden">
          <div className="px-6 pt-4 pb-5 border-b border-gray-200">
            <nav>
              <ol>
                <li>
                  <button
                    onClick={() => navigate(`/${space.slug}/chat`)}
                    className="text-squid-blue hover:underline text-sm bg-transparent border-0 p-0 cursor-pointer"
                  >
                    Chat
                  </button>
                </li>
              </ol>
            </nav>

            <div className="mt-2">
              <h1 className="text-2xl font-semibold text-gray-900 m-0">Chat</h1>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <section className="border border-gray-200 rounded-md bg-white px-6 py-4">
              <div className="flex flex-wrap gap-2">
                {chatTypes.map((type) => {
                  const active = selectedChatType === type.key
                  return (
                    <button
                      key={type.key}
                      type="button"
                      onClick={() => setSelectedChatType(type.key)}
                      className={[
                        'px-4 py-2 rounded text-sm border transition-colors',
                        active
                          ? 'bg-squid-blue text-white border-squid-blue'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400',
                      ].join(' ')}
                    >
                      {type.label}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="border border-gray-200 rounded-md bg-white px-6 py-6">
              <div>
                <div className="mb-5 text-gray-700">
                  Start a conversation with <strong>OpenClaw</strong> targets.
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {openClawOptions.map((option) => (
                    <div
                      key={option.key}
                      className="relative border-2 rounded-lg p-6 overflow-hidden transition-all duration-200"
                      style={{
                        borderColor: hoveredCard === option.key ? '#16a34a' : '#e5e7eb',
                        boxShadow: hoveredCard === option.key ? '0 4px 12px rgba(22,163,74,0.15)' : 'none',
                      }}
                      onMouseEnter={() => setHoveredCard(option.key)}
                      onMouseLeave={() => setHoveredCard(null)}
                    >
                      <div className="flex justify-center mb-4">
                        <div className="w-20 h-20 bg-white border border-emerald-100 rounded-lg flex items-center justify-center">
                          <img src="/openclaw-icon.png" alt="OpenClaw" className="w-12 h-12 object-contain" />
                        </div>
                      </div>

                      <h3 className="text-base font-semibold text-center mb-2">{option.title}</h3>
                      <p className="text-sm text-gray-500 text-center mb-3">{option.desc}</p>

                      {option.recommended ? (
                        <div className="flex justify-center">
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                            Recommended
                          </span>
                        </div>
                      ) : null}

                      {hoveredCard === option.key ? (
                        <div
                          className="absolute inset-0 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
                        >
                          <Button
                            className="shadow-md"
                            onClick={() => navigate(`/${space.slug}/chat/openclaw`)}
                          >
                            Chat Now
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatEntryPage

#!/usr/bin/env python3
import re

file_path = 'src/features/labeling/components/TranscriptReview.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix all MOCK_TYPES references
content = content.replace('...MOCK_TYPES.map(t => ({ label: t.name, value: t.id.toString() }))', '...ASPECTS.map(a => ({ label: a.label, value: a.value }))')
content = content.replace('MOCK_TYPES.map(t => ({ label: t.name, value: t.id.toString() }))', 'ASPECTS.map(a => ({ label: a.label, value: a.value }))')

# Fix AiBadge references
content = content.replace('<AiBadge label={segment.label} />', '<SentimentBadge sentiment={segment.sentiment} />')
content = content.replace('const AiBadge = ({ label }:', 'const SentimentBadge = ({ sentiment }:')
content = content.replace('label: string | null | undefined', 'sentiment: Sentiment | null | undefined')
content = content.replace("if (label === 'danger')", "if (sentiment === 'negative')")
content = content.replace("if (label === 'safe')", "if (sentiment === 'positive')")
content = content.replace("if (sentiment === 'neutral')", "if (sentiment === 'neutral')")

# Fix getTypeName
content = content.replace('{getTypeName(segment.type)}', '{getAspectLabel(segment.aspect)}')

# Fix segment.label/type references
content = content.replace("segment.label === 'danger'", "segment.sentiment === 'negative'")
content = content.replace("segment.label === 'safe'", "segment.sentiment === 'positive'")
content = content.replace('border-l-red-600', 'border-l-red-500')
content = content.replace('segment.user_aspect !== segment.type && segment.type !== null', 'segment.user_aspect !== segment.aspect && segment.aspect !== null')

# Fix filter variables
content = content.replace('setFilterLabel', 'setFilterSentiment')
content = content.replace('setFilterType', 'setFilterAspect')
content = content.replace("if (key === 'label')", "if (key === 'sentiment')")
content = content.replace("if (key === 'type')", "if (key === 'aspect')")

# Fix button labels and values
content = content.replace("{ label: 'Không vi phạm', value: 'safe' }", "{ label: 'Tích cực', value: 'positive' }")
content = content.replace("{ label: 'Vi phạm', value: 'danger' }", "{ label: 'Tiêu cực', value: 'negative' }")
content = content.replace(">Không vi phạm</button>", ">Tích cực</button>")
content = content.replace(">Vi phạm</button>", ">Tiêu cực</button>")
content = content.replace("user_sentiment: 'safe'", "user_sentiment: 'positive', note: 'Đã check tay'")
content = content.replace("user_sentiment: 'danger'", "user_sentiment: 'negative', note: 'Đã check tay'")
content = content.replace("segment.user_sentiment === 'safe'", "segment.user_sentiment === 'positive'")
content = content.replace("segment.user_sentiment === 'danger'", "segment.user_sentiment === 'negative'")

# Add neutral button
old_buttons = '''<div className="flex w-full items-stretch rounded bg-slate-100 p-1 text-sm shadow-inner">
                        <button
                          onClick={() => handleUserUpdate(segment.id, { user_sentiment: 'positive', note: 'Đã check tay' })}
                          className={cn("flex-1 flex items-center justify-center rounded py-2 px-1 text-center font-semibold transition-all uppercase text-xs", segment.user_sentiment === 'positive' ? "bg-green-600 text-white shadow-sm" : "text-slate-700 hover:bg-slate-200/50 hover:text-slate-900")}
                        >Tích cực</button>
                        <button
                          onClick={() => handleUserUpdate(segment.id, { user_sentiment: 'negative', note: 'Đã check tay' })}
                          className={cn("flex-1 flex items-center justify-center rounded py-2 px-1 text-center font-semibold transition-all uppercase text-xs", segment.user_sentiment === 'negative' ? "bg-red-600 text-white shadow-sm" : "text-slate-700 hover:bg-slate-200/50 hover:text-slate-900")}
                        >Tiêu cực</button>
                      </div>'''

new_buttons = '''<div className="flex w-full items-stretch rounded bg-slate-100 p-1 text-sm shadow-inner">
                        {SENTIMENTS.map(s => (
                          <button
                            key={s.value}
                            onClick={() => handleUserUpdate(segment.id, { user_sentiment: s.value, note: 'Đã check tay' })}
                            className={cn(
                              "flex-1 flex items-center justify-center rounded py-1.5 px-1 text-center font-semibold transition-all uppercase text-[10px]",
                              segment.user_sentiment === s.value
                                ? `${s.color} text-white shadow-sm`
                                : "text-slate-700 hover:bg-slate-200/50 hover:text-slate-900"
                            )}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>'''

content = content.replace(old_buttons, new_buttons)

# Fix select placeholder
content = content.replace('placeholder="Chọn thể loại"', 'placeholder="Chọn khía cạnh"')

# Fix filter dropdown for sentiment
old_sentiment_filter = '''{ label: 'Tích cực', value: 'positive' },
                    { label: 'Tiêu cực', value: 'negative' },'''
new_sentiment_filter = '''...SENTIMENTS.map(s => ({ label: s.label, value: s.value })),'''
content = content.replace(old_sentiment_filter, new_sentiment_filter)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Fixed all issues in TranscriptReview.tsx")

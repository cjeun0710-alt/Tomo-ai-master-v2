with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

import re

# Find the start and end of the messy block
start_marker = "{/* Right: Main Calendar area */}"
end_marker = "{/* Tabs */}"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx) + len(end_marker)

if start_idx != -1 and end_idx != -1:
    clean_replacement = """{/* Right: Main Calendar area */}
                              <div className="flex-1">
                                {/* 상단 날짜 미리보기 영역 */}
                                <div className="mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-inner flex items-center justify-between">
                                  <span className="text-xs font-bold text-slate-500">선택된 기간</span>
                                  <span className="text-sm font-black text-teal-600 font-mono tracking-tight">
                                    {tempDateRange ? `${format(tempDateRange.start, 'yyyy-MM-dd')} ~ ${format(tempDateRange.end, 'yyyy-MM-dd')}` : '기간을 선택해주세요'}
                                  </span>
                                </div>
                                {/* Tabs */}"""
    content = content[:start_idx] + clean_replacement + content[end_idx:]
    with open('src/App.tsx', 'w', encoding='utf-8') as f:
        f.write(content)


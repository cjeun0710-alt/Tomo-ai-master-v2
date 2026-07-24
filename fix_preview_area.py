with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

import re

# Match the Right: Main Calendar area block
pattern = r"(\s*)\{/\* Right: Main Calendar area \*/\}\s*<div className=\"flex-1\">\s*\{/\* Tabs \*/\}"
replacement = r"""\1{/* Right: Main Calendar area */}
\1<div className="flex-1">
\1  {/* 상단 날짜 미리보기 영역 */}
\1  <div className="mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-inner flex items-center justify-between">
\1    <span className="text-xs font-bold text-slate-500">선택된 기간</span>
\1    <span className="text-sm font-black text-teal-600 font-mono">
\1      {tempDateRange ? `${format(tempDateRange.start, 'yyyy-MM-dd')} ~ ${format(tempDateRange.end, 'yyyy-MM-dd')}` : '기간을 선택해주세요'}
\1    </span>
\1  </div>
\1  {/* Tabs */}"""

if "{/* 상단 날짜 미리보기 영역 */}" not in content:
    content = re.sub(pattern, replacement, content)
    with open('src/App.tsx', 'w', encoding='utf-8') as f:
        f.write(content)


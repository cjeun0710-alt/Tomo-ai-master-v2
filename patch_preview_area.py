with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

import re

right_area_start = """                              {/* Right: Main Calendar area */}
                              <div className="flex-1">
                                {/* Tabs */}"""

if "상단 날짜 미리보기 영역" not in content:
    replacement = """                              {/* Right: Main Calendar area */}
                              <div className="flex-1">
                                {/* 상단 날짜 미리보기 영역 */}
                                <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center justify-between">
                                  <span className="text-xs font-bold text-slate-500">선택된 기간</span>
                                  <span className="text-sm font-black text-teal-600">
                                    {tempDateRange ? `${format(tempDateRange.start, 'yyyy-MM-dd')} ~ ${format(tempDateRange.end, 'yyyy-MM-dd')}` : '기간을 선택해주세요'}
                                  </span>
                                </div>
                                {/* Tabs */}"""
    content = content.replace(right_area_start, replacement)
    
    # Revert the setSelectedDateLabel on preset click
    content = content.replace(
        "// 프리셋 클릭 즉시 상단 날짜 미리보기 영역에 업데이트 (가정: 임시로 보여주는 영역이 있다면)\n                                      // \"상단 날짜 미리보기 영역\"을 현재 적용된 DateRange를 표시하는 공간으로 해석하여 setSelectedDateLabel 에도 반영\n                                      setSelectedDateLabel(`${format(start, 'yyyy-MM-dd')} ~ ${format(end, 'yyyy-MM-dd')}`);",
        "// 프리셋 클릭 시 tempDateRange가 변경되므로 상단 미리보기 영역(tempDateRange를 렌더링하는 부분)에 즉시 반영됨"
    )

    with open('src/App.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

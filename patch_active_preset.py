with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

import re

state_patch = "  const [activePreset, setActivePreset] = useState<string>('이번 주');\n  const [calendarDate, setCalendarDate]"

if "const [activePreset" not in content:
    content = content.replace("  const [calendarDate, setCalendarDate]", state_patch)

presets_start = "                              {/* Left: Presets */}"
presets_end = "                              {/* Right: Main Calendar area */}"

start_idx = content.find(presets_start)
end_idx = content.find(presets_end, start_idx)

if start_idx != -1 and end_idx != -1:
    replacement = """                              {/* Left: Presets */}
                              <div className="flex flex-col gap-2 min-w-[120px] border-r border-slate-100 pr-4">
                                {['이번 주', '지난 주', '이번 달', '지난 달', '올해 학년도', '지난 학년도'].map(preset => (
                                  <button
                                    key={preset}
                                    onClick={() => {
                                      setActivePreset(preset);
                                      const now = new Date();
                                      let start: Date;
                                      let end: Date;
                                      
                                      if (preset === '이번 주') {
                                        start = startOfWeek(now);
                                        end = endOfWeek(now);
                                        setDateRangeMode('weekly');
                                        setCalendarDate(now);
                                      } else if (preset === '지난 주') {
                                        const lastWeek = subWeeks(now, 1);
                                        start = startOfWeek(lastWeek);
                                        end = endOfWeek(lastWeek);
                                        setDateRangeMode('weekly');
                                        setCalendarDate(lastWeek);
                                      } else if (preset === '이번 달') {
                                        start = startOfMonth(now);
                                        end = endOfMonth(now);
                                        setDateRangeMode('monthly');
                                        setCalendarDate(now);
                                      } else if (preset === '지난 달') {
                                        const lastMonth = subMonths(now, 1);
                                        start = startOfMonth(lastMonth);
                                        end = endOfMonth(lastMonth);
                                        setDateRangeMode('monthly');
                                        setCalendarDate(lastMonth);
                                      } else if (preset === '올해 학년도') {
                                        const currentYear = now.getMonth() >= 2 ? now.getFullYear() : now.getFullYear() - 1;
                                        start = new Date(currentYear, 2, 1);
                                        end = subDays(new Date(currentYear + 1, 2, 1), 1);
                                        setDateRangeMode('yearly');
                                        setCalendarDate(start);
                                      } else { // 지난 학년도
                                        const prevYear = (now.getMonth() >= 2 ? now.getFullYear() : now.getFullYear() - 1) - 1;
                                        start = new Date(prevYear, 2, 1);
                                        end = subDays(new Date(prevYear + 1, 2, 1), 1);
                                        setDateRangeMode('yearly');
                                        setCalendarDate(start);
                                      }
                                      
                                      setTempDateRange({ start, end });
                                      
                                      // 프리셋 클릭 즉시 상단 날짜 미리보기 영역에 업데이트 (가정: 임시로 보여주는 영역이 있다면)
                                      // "상단 날짜 미리보기 영역"을 현재 적용된 DateRange를 표시하는 공간으로 해석하여 setSelectedDateLabel 에도 반영
                                      setSelectedDateLabel(`${format(start, 'yyyy-MM-dd')} ~ ${format(end, 'yyyy-MM-dd')}`);
                                    }}
                                    className={`text-left px-3 py-2 rounded-lg text-sm font-bold transition-colors ${activePreset === preset ? 'bg-teal-50 text-teal-600' : 'text-slate-600 hover:bg-slate-50'}`}
                                  >
                                    {preset}
                                  </button>
                                ))}
                              </div>
                              
"""
    content = content[:start_idx] + replacement + content[end_idx:]
    with open('src/App.tsx', 'w', encoding='utf-8') as f:
        f.write(content)


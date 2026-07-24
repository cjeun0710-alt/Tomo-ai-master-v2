with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

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
                                      setSelectedDateLabel(preset);
                                      const now = new Date();
                                      if (preset === '이번 주') {
                                        setTempDateRange({ start: startOfWeek(now), end: endOfWeek(now) });
                                        setDateRangeMode('weekly');
                                        setCalendarDate(now);
                                      } else if (preset === '지난 주') {
                                        const lastWeek = subWeeks(now, 1);
                                        setTempDateRange({ start: startOfWeek(lastWeek), end: endOfWeek(lastWeek) });
                                        setDateRangeMode('weekly');
                                        setCalendarDate(lastWeek);
                                      } else if (preset === '이번 달') {
                                        setTempDateRange({ start: startOfMonth(now), end: endOfMonth(now) });
                                        setDateRangeMode('monthly');
                                        setCalendarDate(now);
                                      } else if (preset === '지난 달') {
                                        const lastMonth = subMonths(now, 1);
                                        setTempDateRange({ start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) });
                                        setDateRangeMode('monthly');
                                        setCalendarDate(lastMonth);
                                      } else if (preset === '올해 학년도') {
                                        const currentYear = now.getMonth() >= 2 ? now.getFullYear() : now.getFullYear() - 1;
                                        const start = new Date(currentYear, 2, 1);
                                        const end = subDays(new Date(currentYear + 1, 2, 1), 1);
                                        setTempDateRange({ start, end });
                                        setDateRangeMode('yearly');
                                        setCalendarDate(start);
                                      } else if (preset === '지난 학년도') {
                                        const prevYear = (now.getMonth() >= 2 ? now.getFullYear() : now.getFullYear() - 1) - 1;
                                        const start = new Date(prevYear, 2, 1);
                                        const end = subDays(new Date(prevYear + 1, 2, 1), 1);
                                        setTempDateRange({ start, end });
                                        setDateRangeMode('yearly');
                                        setCalendarDate(start);
                                      }
                                    }}
                                    className={`text-left px-3 py-2 rounded-lg text-sm font-bold transition-colors ${selectedDateLabel === preset ? 'bg-teal-50 text-teal-600' : 'text-slate-600 hover:bg-slate-50'}`}
                                  >
                                    {preset}
                                  </button>
                                ))}
                              </div>
                              
"""
    new_content = content[:start_idx] + replacement + content[end_idx:]
    with open('src/App.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
else:
    print(f"Could not find markers. start_idx={start_idx}, end_idx={end_idx}")


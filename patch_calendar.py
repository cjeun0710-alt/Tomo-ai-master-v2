with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

import re

fake_calendar_start = "                                {/* Fake Calendar Grid */}"
actions_start = "                                {/* Actions */}"

start_idx = content.find(fake_calendar_start)
end_idx = content.find(actions_start, start_idx)

if start_idx != -1 and end_idx != -1:
    replacement = """                                {/* Date Picker Area */}
                                {dateRangeMode === 'weekly' && (() => {
                                  const year = calendarDate.getFullYear();
                                  const month = calendarDate.getMonth();
                                  const firstDayOfMonth = new Date(year, month, 1);
                                  const startDayOfWeek = getDay(firstDayOfMonth);
                                  const daysInMonth = getDaysInMonth(calendarDate);
                                  const blanks = Array.from({ length: startDayOfWeek }).map((_, i) => i);
                                  const days = Array.from({ length: daysInMonth }).map((_, i) => new Date(year, month, i + 1));
                                  
                                  return (
                                    <div className="mb-4">
                                      <div className="flex justify-between items-center mb-2 px-2">
                                        <button onClick={() => setCalendarDate(subMonths(calendarDate, 1))} className="text-slate-400 hover:text-slate-600 p-1"><ChevronLeft className="w-4 h-4" /></button>
                                        <span className="text-xs font-bold text-slate-700">{format(calendarDate, 'yyyy년 M월', { locale: ko })}</span>
                                        <button onClick={() => setCalendarDate(addMonths(calendarDate, 1))} className="text-slate-400 hover:text-slate-600 p-1"><ChevronRight className="w-4 h-4" /></button>
                                      </div>
                                      <div className="grid grid-cols-7 gap-1 text-center">
                                        {['일', '월', '화', '수', '목', '금', '토'].map(d => (
                                          <div key={d} className="text-[10px] font-bold text-slate-400 py-1">{d}</div>
                                        ))}
                                        {blanks.map(b => <div key={`blank-${b}`} className="py-1.5" />)}
                                        {days.map(d => {
                                          const isSelected = tempDateRange && d >= tempDateRange.start && d <= tempDateRange.end;
                                          return (
                                            <button
                                              key={d.toString()}
                                              onClick={() => setTempDateRange({ start: startOfWeek(d), end: endOfWeek(d) })}
                                              className={`text-xs py-1.5 rounded-md font-medium transition-colors ${isSelected ? 'bg-teal-500 text-white shadow-sm' : 'text-slate-600 hover:bg-teal-50 hover:text-teal-600'}`}
                                            >
                                              {d.getDate()}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })()}

                                {dateRangeMode === 'monthly' && (() => {
                                  const year = calendarDate.getFullYear();
                                  const months = Array.from({ length: 12 }).map((_, i) => i);
                                  return (
                                    <div className="mb-4">
                                      <div className="flex justify-between items-center mb-4 px-2">
                                        <button onClick={() => setCalendarDate(subYears(calendarDate, 1))} className="text-slate-400 hover:text-slate-600 p-1"><ChevronLeft className="w-4 h-4" /></button>
                                        <span className="text-xs font-bold text-slate-700">{year}년</span>
                                        <button onClick={() => setCalendarDate(addYears(calendarDate, 1))} className="text-slate-400 hover:text-slate-600 p-1"><ChevronRight className="w-4 h-4" /></button>
                                      </div>
                                      <div className="grid grid-cols-3 gap-2">
                                        {months.map(m => {
                                          const d = new Date(year, m, 1);
                                          const isSelected = tempDateRange && tempDateRange.start.getFullYear() === year && tempDateRange.start.getMonth() === m;
                                          return (
                                            <button
                                              key={m}
                                              onClick={() => setTempDateRange({ start: startOfMonth(d), end: endOfMonth(d) })}
                                              className={`text-xs py-3 rounded-lg font-bold transition-colors ${isSelected ? 'bg-teal-500 text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-teal-50 hover:text-teal-600'}`}
                                            >
                                              {m + 1}월
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })()}

                                {dateRangeMode === 'yearly' && (() => {
                                  const currentYear = calendarDate.getFullYear();
                                  const startYear = currentYear - (currentYear % 6);
                                  const years = Array.from({ length: 6 }).map((_, i) => startYear + i);
                                  return (
                                    <div className="mb-4">
                                      <div className="flex justify-between items-center mb-4 px-2">
                                        <button onClick={() => setCalendarDate(subYears(calendarDate, 6))} className="text-slate-400 hover:text-slate-600 p-1"><ChevronLeft className="w-4 h-4" /></button>
                                        <span className="text-xs font-bold text-slate-700">{startYear} - {startYear + 5}</span>
                                        <button onClick={() => setCalendarDate(addYears(calendarDate, 6))} className="text-slate-400 hover:text-slate-600 p-1"><ChevronRight className="w-4 h-4" /></button>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        {years.map(y => {
                                          const d = new Date(y, 0, 1);
                                          const isSelected = tempDateRange && tempDateRange.start.getFullYear() === y;
                                          return (
                                            <button
                                              key={y}
                                              onClick={() => setTempDateRange({ start: startOfYear(d), end: endOfYear(d) })}
                                              className={`text-xs py-4 rounded-lg font-bold transition-colors ${isSelected ? 'bg-teal-500 text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-teal-50 hover:text-teal-600'}`}
                                            >
                                              {y}년
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })()}

"""
    new_content = content[:start_idx] + replacement + content[end_idx:]
    with open('src/App.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
else:
    print(f"Could not find markers. start_idx={start_idx}, end_idx={end_idx}")


with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

import re
content = content.replace(
    "onClick={() => setTempDateRange({ start: startOfWeek(d), end: endOfWeek(d) })}",
    "onClick={() => { setTempDateRange({ start: startOfWeek(d), end: endOfWeek(d) }); setActivePreset(''); }}"
)

content = content.replace(
    "onClick={() => setTempDateRange({ start: startOfMonth(d), end: endOfMonth(d) })}",
    "onClick={() => { setTempDateRange({ start: startOfMonth(d), end: endOfMonth(d) }); setActivePreset(''); }}"
)

content = content.replace(
    "onClick={() => setTempDateRange({ start: startOfYear(d), end: endOfYear(d) })}",
    "onClick={() => { setTempDateRange({ start: startOfYear(d), end: endOfYear(d) }); setActivePreset(''); }}"
)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

import re
with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()
content = re.sub(r"import { format, subDays, subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subYears } from 'date-fns';", "import { format, subDays, subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subYears, startOfYear, endOfYear, addMonths, addYears, getDaysInMonth, getDay, isSameDay } from 'date-fns';", content)
with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

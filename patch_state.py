with open('src/App.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    new_lines.append(line)
    if "const [selectedDateLabel, setSelectedDateLabel] = useState('이번 주');" in line:
        new_lines.append("  const [calendarDate, setCalendarDate] = useState<Date>(new Date(2026, 5, 1));\n")
        new_lines.append("  const [tempDateRange, setTempDateRange] = useState<{start: Date, end: Date} | null>(null);\n")

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

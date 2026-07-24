with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

import re
content = re.sub(
    r"// 프리셋 클릭 즉시 상단 날짜 미리보기 영역에 업데이트.*?\n.*?\n.*?setSelectedDateLabel.*?;",
    "// 프리셋 클릭 즉시 캘린더 내부의 상단 날짜 미리보기 영역(선택된 기간)에 즉시 바인딩 됨",
    content,
    flags=re.DOTALL
)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

import re
match = re.search(r'\{/\* Fake Calendar Grid \*/\}.*?\{/\* Actions \*/\}', content, re.DOTALL)
if match:
    print(match.group(0))

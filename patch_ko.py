with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

import re
if 'import { ko } from "date-fns/locale";' not in content and "import { ko } from 'date-fns/locale';" not in content:
    content = re.sub(r"(import \{.*?\} from 'date-fns';)", r"\1\nimport { ko } from 'date-fns/locale';", content)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

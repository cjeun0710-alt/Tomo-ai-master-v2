with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

import re

apply_start = """                                  <button 
                                    onClick={() => {
                                      setShowDatePicker(false);
                                      triggerToast('✅ 기간이 적용되었습니다.');
                                    }}"""

apply_replacement = """                                  <button 
                                    onClick={() => {
                                      if (tempDateRange) {
                                        setSelectedDateLabel(`${format(tempDateRange.start, 'yyyy-MM-dd')} ~ ${format(tempDateRange.end, 'yyyy-MM-dd')}`);
                                      }
                                      setShowDatePicker(false);
                                      triggerToast('✅ 기간이 적용되었습니다.');
                                    }}"""

if apply_start in content:
    content = content.replace(apply_start, apply_replacement)
    with open('src/App.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
else:
    print("Could not find apply_start")


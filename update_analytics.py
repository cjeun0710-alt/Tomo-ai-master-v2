with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "              {/* MENU 2: DATA DASHBOARD (ANALYTICS VIEW) */}"
end_marker = "              {adminTab === 'folders' && (() => {"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx)

if start_idx != -1 and end_idx != -1:
    replacement = """              {/* MENU 2: DATA DASHBOARD (ANALYTICS VIEW) */}
              {adminTab === 'analytics' && (
                <div className="space-y-6">
                  {/* Top Header Row with Date Range Picker and Tabs */}
                  <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b border-slate-200 pb-4">
                    <div className="flex items-center gap-4">
                      <h2 className="sys-heading-main text-[#001C3D]">
                        데이터 분석 (Quantitative Analytics Console)
                      </h2>

                      {/* Advanced Date Range Picker */}
                      <div className="relative">
                        <button 
                          onClick={() => setShowDatePicker(!showDatePicker)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-slate-300 transition-colors"
                        >
                          <CalendarDays className="w-4 h-4 text-slate-500" />
                          <span className="text-xs font-bold text-slate-700">{selectedDateLabel}</span>
                          <ChevronDown className="w-3 h-3 text-slate-400" />
                        </button>
                        
                        <AnimatePresence>
                          {showDatePicker && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-50 flex gap-4 min-w-[500px]"
                            >
                              {/* Left: Presets */}
                              <div className="flex flex-col gap-2 min-w-[120px] border-r border-slate-100 pr-4">
                                {['이번 주', '지난 주', '이번 달', '지난 달', '올해 학년도', '지난 학년도'].map(preset => (
                                  <button
                                    key={preset}
                                    onClick={() => setSelectedDateLabel(preset)}
                                    className={`text-left px-3 py-2 rounded-lg text-sm font-bold transition-colors ${selectedDateLabel === preset ? 'bg-teal-50 text-teal-600' : 'text-slate-600 hover:bg-slate-50'}`}
                                  >
                                    {preset}
                                  </button>
                                ))}
                              </div>
                              
                              {/* Right: Main Calendar area */}
                              <div className="flex-1">
                                {/* Tabs */}
                                <div className="flex gap-2 mb-4 bg-slate-50 p-1 rounded-lg">
                                  {(['weekly', 'monthly', 'yearly'] as const).map(mode => (
                                    <button
                                      key={mode}
                                      className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-colors ${dateRangeMode === mode ? 'bg-white shadow-sm text-teal-600' : 'text-slate-500 hover:text-slate-700'}`}
                                      onClick={() => setDateRangeMode(mode)}
                                    >
                                      {mode === 'weekly' ? '주간' : mode === 'monthly' ? '월간' : '연간'}
                                    </button>
                                  ))}
                                </div>
                                
                                {/* Fake Calendar Grid */}
                                <div className="grid grid-cols-7 gap-1 text-center mb-4">
                                  {['일', '월', '화', '수', '목', '금', '토'].map(d => (
                                    <div key={d} className="text-[10px] font-bold text-slate-400 py-1">{d}</div>
                                  ))}
                                  {Array.from({length: 31}).map((_, i) => (
                                    <button key={i} onClick={() => setSelectedDateLabel(`${i+1}일 선택됨`)} className={`text-xs py-1.5 rounded-md font-medium hover:bg-teal-50 hover:text-teal-600 ${i === 15 ? 'bg-teal-500 text-white hover:bg-teal-600 hover:text-white' : 'text-slate-600'}`}>
                                      {i + 1}
                                    </button>
                                  ))}
                                </div>
                                
                                {/* Actions */}
                                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                                  <button 
                                    onClick={() => setShowDatePicker(false)}
                                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                                  >
                                    취소
                                  </button>
                                  <button 
                                    onClick={() => {
                                      setShowDatePicker(false);
                                      triggerToast('✅ 기간이 적용되었습니다.');
                                    }}
                                    className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors shadow-sm"
                                  >
                                    적용
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Analytics Tabs */}
                    <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl">
                      {[
                        { id: 'branch', label: '지사별 사용량' },
                        { id: 'kindergarten', label: '원별 사용량' },
                        { id: 'template', label: '템플릿별 사용량' }
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setAnalyticsTab(tab.id as any)}
                          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            analyticsTab === tab.id 
                              ? 'bg-white text-[#001C3D] shadow-sm' 
                              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tab Content */}
                  <div className="mt-6">
                    {/* 1. 지사별 사용량 탭 */}
                    {analyticsTab === 'branch' && (
                      <div className="space-y-6 animate-fadeIn">
                        <div className="flex justify-between items-end mb-2">
                          <h3 className="text-sm font-black text-[#001C3D]">상위 5개 지사별 사용량</h3>
                          <button
                            onClick={() => {
                              const csvHeaders = 'No,지사명,관리 원 수,순 실행 수,누적 실행 수';
                              const csvRows = branchData.map(d => `${d.no},"${d.name}",${d['관리 원 수']},${d['순 실행 수']},${d['누적 실행 수']}`).join('\\n');
                              const blob = new Blob(['\\uFEFF' + csvHeaders + '\\n' + csvRows], { type: 'text/csv;charset=utf-8;' });
                              const link = document.createElement('a');
                              link.href = URL.createObjectURL(blob);
                              link.download = `지사별_사용량_${format(new Date(), 'yyyyMMdd')}.csv`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              triggerToast('✅ 지사별 사용량 데이터가 엑셀(CSV)로 다운로드 되었습니다.');
                            }}
                            className="px-3 py-1.5 bg-[#001C3D] hover:bg-[#002D5E] text-[#8EF6D6] rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                          >
                            <Download className="w-3.5 h-3.5" />
                            엑셀 다운로드
                          </button>
                        </div>
                        
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={branchData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                              <XAxis type="number" stroke="#94A3B8" fontSize={10} />
                              <YAxis dataKey="name" type="category" stroke="#64748B" fontSize={11} fontWeight={700} width={80} />
                              <Tooltip
                                contentStyle={{ backgroundColor: '#0F172A', border: 'none', borderRadius: '8px', color: '#fff' }}
                                itemStyle={{ color: '#E2E8F0', fontSize: '12px' }}
                                labelStyle={{ color: '#94A3B8', fontWeight: 'bold', marginBottom: '4px' }}
                                cursor={{ fill: '#F1F5F9' }}
                              />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar dataKey="순 실행 수" fill="#FF6B6B" radius={[0, 4, 4, 0]} />
                              <Bar dataKey="누적 실행 수" fill="#001C3D" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-4">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                              <tr>
                                <th className="px-4 py-3">No</th>
                                <th className="px-4 py-3">지사명</th>
                                <th className="px-4 py-3">관리 원 수</th>
                                <th className="px-4 py-3">순 실행 수</th>
                                <th className="px-4 py-3">누적 실행 수</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {branchData.map((row) => (
                                <tr key={row.no} className="hover:bg-slate-50/50">
                                  <td className="px-4 py-3 font-mono text-slate-400">{row.no}</td>
                                  <td className="px-4 py-3 font-bold text-slate-700">{row.name}</td>
                                  <td className="px-4 py-3 text-slate-600">{row['관리 원 수'].toLocaleString()}</td>
                                  <td className="px-4 py-3 font-mono font-bold text-teal-600">{row['순 실행 수'].toLocaleString()}</td>
                                  <td className="px-4 py-3 font-mono font-bold text-[#001C3D]">{row['누적 실행 수'].toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* 2. 원별 사용량 탭 */}
                    {analyticsTab === 'kindergarten' && (
                      <div className="space-y-6 animate-fadeIn">
                        <div className="flex justify-between items-end mb-2">
                          <h3 className="text-sm font-black text-[#001C3D]">원별 사용량 및 접속 추이</h3>
                          <button
                            onClick={() => {
                              const csvHeaders = 'No,원명,소속 지사,접속 수,실행 수';
                              const csvRows = kindergartenTableData.map(d => `${d.no},"${d.name}","${d.branch}",${d['접속 수']},${d['실행 수']}`).join('\\n');
                              const blob = new Blob(['\\uFEFF' + csvHeaders + '\\n' + csvRows], { type: 'text/csv;charset=utf-8;' });
                              const link = document.createElement('a');
                              link.href = URL.createObjectURL(blob);
                              link.download = `원별_사용량_${format(new Date(), 'yyyyMMdd')}.csv`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              triggerToast('✅ 원별 사용량 데이터가 엑셀(CSV)로 다운로드 되었습니다.');
                            }}
                            className="px-3 py-1.5 bg-[#001C3D] hover:bg-[#002D5E] text-[#8EF6D6] rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                          >
                            <Download className="w-3.5 h-3.5" />
                            엑셀 다운로드
                          </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[250px]">
                            <h4 className="text-xs font-bold text-slate-500 mb-4">원별 주간 접속 추이</h4>
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={kindergartenTrendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} />
                                <YAxis stroke="#94A3B8" fontSize={10} />
                                <Tooltip
                                  contentStyle={{ backgroundColor: '#0F172A', border: 'none', borderRadius: '8px', color: '#fff' }}
                                  itemStyle={{ color: '#E2E8F0', fontSize: '12px', fontWeight: 'bold' }}
                                  labelStyle={{ color: '#94A3B8', fontWeight: 'bold', marginBottom: '4px' }}
                                />
                                <Line type="monotone" dataKey="접속 수" stroke="#FF6B6B" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[250px]">
                            <h4 className="text-xs font-bold text-slate-500 mb-4">연령별 템플릿 사용량</h4>
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={ageUsageData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} />
                                <YAxis stroke="#94A3B8" fontSize={10} />
                                <Tooltip
                                  contentStyle={{ backgroundColor: '#0F172A', border: 'none', borderRadius: '8px', color: '#fff' }}
                                  itemStyle={{ color: '#E2E8F0', fontSize: '12px' }}
                                  labelStyle={{ color: '#94A3B8', fontWeight: 'bold', marginBottom: '4px' }}
                                  cursor={{ fill: '#F1F5F9' }}
                                />
                                <Bar dataKey="사용량" fill="#001C3D" radius={[4, 4, 0, 0]} barSize={40} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-4">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                              <tr>
                                <th className="px-4 py-3">No</th>
                                <th className="px-4 py-3">원명</th>
                                <th className="px-4 py-3">소속 지사</th>
                                <th className="px-4 py-3">접속 수</th>
                                <th className="px-4 py-3">실행 수</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {kindergartenTableData.map((row) => (
                                <tr key={row.no} className="hover:bg-slate-50/50">
                                  <td className="px-4 py-3 font-mono text-slate-400">{row.no}</td>
                                  <td className="px-4 py-3 font-bold text-slate-700">{row.name}</td>
                                  <td className="px-4 py-3 text-slate-600"><span className="bg-slate-100 px-2 py-0.5 rounded text-[10px]">{row.branch}</span></td>
                                  <td className="px-4 py-3 font-mono font-bold text-teal-600">{row['접속 수'].toLocaleString()}</td>
                                  <td className="px-4 py-3 font-mono font-bold text-[#FF6B6B]">{row['실행 수'].toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* 3. 템플릿별 사용량 탭 */}
                    {analyticsTab === 'template' && (
                      <div className="space-y-4 animate-fadeIn">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 mb-2">
                          <h3 className="text-sm font-black text-[#001C3D]">템플릿별 상세 사용량</h3>
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="relative w-full sm:w-64">
                              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                              <input
                                type="text"
                                placeholder="템플릿명 검색..."
                                value={searchTemplate}
                                onChange={(e) => setSearchTemplate(e.target.value)}
                                className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all"
                              />
                            </div>
                            <button
                              onClick={() => {
                                const csvHeaders = 'No,템플릿명,대상 연령,다운로드 수,순 실행 수';
                                const dataToExport = searchTemplate ? templateTableData.filter(d => d.name.includes(searchTemplate)) : templateTableData;
                                const csvRows = dataToExport.map(d => `${d.no},"${d.name}","${d.age}",${d['다운로드 수']},${d['순 실행 수']}`).join('\\n');
                                const blob = new Blob(['\\uFEFF' + csvHeaders + '\\n' + csvRows], { type: 'text/csv;charset=utf-8;' });
                                const link = document.createElement('a');
                                link.href = URL.createObjectURL(blob);
                                link.download = `템플릿별_사용량_${format(new Date(), 'yyyyMMdd')}.csv`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                triggerToast('✅ 템플릿별 사용량 데이터가 엑셀(CSV)로 다운로드 되었습니다.');
                              }}
                              className="px-3 py-1.5 bg-[#001C3D] hover:bg-[#002D5E] text-[#8EF6D6] rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                            >
                              <Download className="w-3.5 h-3.5" />
                              엑셀 다운로드
                            </button>
                          </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-4">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                              <tr>
                                <th className="px-4 py-3">No</th>
                                <th className="px-4 py-3 w-1/3">템플릿명</th>
                                <th className="px-4 py-3 text-center">대상 연령</th>
                                <th className="px-4 py-3 text-right">다운로드(복사) 수</th>
                                <th className="px-4 py-3 text-right">순 실행 수</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {templateTableData
                                .filter(row => !searchTemplate || row.name.includes(searchTemplate))
                                .map((row) => (
                                <tr key={row.no} className="hover:bg-slate-50/50">
                                  <td className="px-4 py-3 font-mono text-slate-400">{row.no}</td>
                                  <td className="px-4 py-3 font-bold text-[#001C3D]">{row.name}</td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="bg-[#FFF1F2] text-[#E11D48] px-2 py-0.5 rounded text-[10px] font-bold border border-[#E11D48]/20">{row.age}</span>
                                  </td>
                                  <td className="px-4 py-3 font-mono font-bold text-slate-600 text-right">{row['다운로드 수'].toLocaleString()}</td>
                                  <td className="px-4 py-3 font-mono font-black text-[#FF6B6B] text-right">{row['순 실행 수'].toLocaleString()}</td>
                                </tr>
                              ))}
                              {templateTableData.filter(row => !searchTemplate || row.name.includes(searchTemplate)).length === 0 && (
                                <tr>
                                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400 font-bold">
                                    검색된 템플릿이 없습니다.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}\n"""
    new_content = content[:start_idx] + replacement + content[end_idx:]
    with open('src/App.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
else:
    print(f"Could not find markers. start_idx={start_idx}, end_idx={end_idx}")


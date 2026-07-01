import React, { useState, useEffect } from 'react';
import { PromptTemplate } from '../types';
import { CATEGORIES } from '../data';
import { X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (prompt: Partial<PromptTemplate>) => void;
  editingPrompt: PromptTemplate | null;
}

export default function PromptModal({ isOpen, onClose, onSave, editingPrompt }: PromptModalProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('가정통신문');
  const [description, setDescription] = useState('');
  const [promptText, setPromptText] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  useEffect(() => {
    if (editingPrompt) {
      setTitle(editingPrompt.title);
      setCategory(editingPrompt.category);
      setDescription(editingPrompt.description);
      setPromptText(editingPrompt.promptText);
      setTagsInput(editingPrompt.tags.join(', '));
    } else {
      setTitle('');
      setCategory('가정통신문');
      setDescription('');
      setPromptText('');
      setTagsInput('');
    }
  }, [editingPrompt, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !promptText.trim()) return;

    const tagsArray = tagsInput
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    onSave({
      id: editingPrompt?.id,
      title: title.trim(),
      category,
      description: description.trim(),
      promptText: promptText.trim(),
      tags: tagsArray.length > 0 ? tagsArray : [category],
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900"
          id="modal-backdrop"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-10"
          id="modal-container"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="sys-heading-sub font-sans text-slate-800 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-accent-coral inline-block"></span>
              {editingPrompt ? '프롬프트 편집' : '새 프롬프트 작성'}
            </h3>
            <button
              id="close-modal-btn"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block sys-caption font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                프롬프트 제목 *
              </label>
              <input
                id="input-prompt-title"
                type="text"
                required
                placeholder="예: 만 3세 봄맞이 야외 숲놀이 가정통신문"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-navy/20 focus:border-primary-navy transition-all placeholder:text-slate-400 sys-body"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block sys-caption font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                  카테고리
                </label>
                <select
                  id="select-prompt-category"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-navy/20 focus:border-primary-navy bg-white sys-body"
                >
                  {CATEGORIES.filter(cat => cat !== '전체').map(cat => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block sys-caption font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                  태그 목록 (쉼표 , 로 구분)
                </label>
                <input
                  id="input-prompt-tags"
                  type="text"
                  placeholder="예: 가정통신문, 만3세, 따뜻한문체"
                  value={tagsInput}
                  onChange={e => setTagsInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-navy/20 focus:border-primary-navy transition-all placeholder:text-slate-400 sys-body"
                />
              </div>
            </div>

            <div>
              <label className="block sys-caption font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                프롬프트 한 줄 설명
              </label>
              <input
                id="input-prompt-description"
                type="text"
                placeholder="예: 부모 대상 놀이 소통을 돕는 친화적인 설명문 메이커"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-navy/20 focus:border-primary-navy transition-all placeholder:text-slate-400 sys-body"
              />
            </div>

            <div>
              <label className="block sys-caption font-semibold text-slate-500 mb-1.5 uppercase tracking-wider flex justify-between">
                <span>프롬프트 명령문 본문 (System / User Message Context) *</span>
                <span className="text-[10px] text-accent-coral font-normal">AI 모델 지시사항을 상세히 작성하세요</span>
              </label>
              <textarea
                id="input-prompt-text"
                required
                rows={5}
                placeholder="인공지능 모델에게 요구할 꼼꼼한 지침을 한글로 기재해 주세요.&#13;예 : 너는 만 3세 반을 담임하는 교사야. 이번 주 모래놀이와 숲 산책 에피소드를 근거로 다정다감하고 공손한 문체의 가정통신문 초안을 작성해줘."
                value={promptText}
                onChange={e => setPromptText(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-navy/20 focus:border-primary-navy transition-all placeholder:text-slate-400 sys-body font-mono leading-relaxed resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                id="cancel-modal-btn"
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 sys-button transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                id="submit-modal-btn"
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-accent-coral hover:bg-accent-coral-hover text-white sys-button transition-colors flex items-center gap-1.5 shadow-sm shadow-accent-coral/20 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                {editingPrompt ? '변경사항 저장' : '등록 완료'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

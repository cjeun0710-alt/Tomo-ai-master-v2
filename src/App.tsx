import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import {
  Sparkles,
  Search,
  Filter,
  Download,
  Award,
  Gift,
  Smile,
  Edit2,
  EyeOff,
  Eye,
  BarChart2,
  Trash2,
  Check,
  ChevronRight,
  TrendingUp,
  X,
  Plus,
  AlertTriangle,
  HelpCircle,
  Copy,
  FolderSync,
  Heart,
  Save,
  RotateCcw,
  Star,
  Layers,
  ArrowRight,
  Sliders,
  CheckSquare,
  BookOpen,
  Info,
  ExternalLink,
  ChevronLeft,
  ChevronDown,
  Settings,
  MessageSquare,
  Folder,
  FolderInput,
  Globe,
  Users,
  MoreVertical,
  LogOut,
  Palette,
  Lock,
  Cloud
} from 'lucide-react';
import { INITIAL_PROMPTS, INITIAL_DESIGN_PROMPTS, INITIAL_TEACHERS, CATEGORIES, TAGS } from './data';
import { PromptTemplate, Teacher } from './types';
import aiGoLogo from './assets/logo_clear.png';

// Floating Particle/Sticker Interface
interface FlyingParticle {
  id: number;
  emoji: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
}

// ==========================================
// SHARED CUSTOM COMPONENTS FOR UNIFIED STYLING
// ==========================================
export function PromptCategoryPill({ category }: { category: string }) {
  return (
    <span className="sys-tag bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-bold">
      {category}
    </span>
  );
}

export function PromptHashtags({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-1 mt-3">
      {tags.map(tag => (
        <span key={tag} className="sys-tag bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded border border-sky-105">
          #{tag}
        </span>
      ))}
    </div>
  );
}

export function renderHighlightedText(text: string): React.ReactNode {
  if (!text) return '';
  
  // Split by balanced curly braces { ... }
  const chunkParts: string[] = [];
  let currentPlain = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '{') {
      if (currentPlain) {
        chunkParts.push(currentPlain);
        currentPlain = '';
      }
      let braceContent = '{';
      i++;
      let depth = 1;
      while (i < text.length && depth > 0) {
        const char = text[i];
        braceContent += char;
        if (char === '{') depth++;
        else if (char === '}') depth--;
        i++;
      }
      chunkParts.push(braceContent);
    } else {
      currentPlain += text[i];
      i++;
    }
  }
  if (currentPlain) {
    chunkParts.push(currentPlain);
  }

  return (
    <>
      {chunkParts.map((part, index) => {
        if (part.startsWith('{') && part.endsWith('}')) {
          const content = part.slice(1, -1);
          return (
            <span key={index} className="text-blue-600 font-bold bg-blue-50/80 px-1 rounded mx-0.5 border border-blue-100 italic">
              {`{${content}}`}
            </span>
          );
        }
        return part;
      })}
    </>
  );
}

// Helper for loose matching of strings (removing prefix '#', trimming, and case-insensitive check)
const isLooseMatch = (str1: string, str2: string) => {
  if (!str1 || !str2) return false;
  const s1 = str1.replace(/^#/, '').trim().toLowerCase();
  const s2 = str2.replace(/^#/, '').trim().toLowerCase();
  return s1.includes(s2) || s2.includes(s1);
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Firestore CRUD helpers
const savePromptToFirestore = async (prompt: PromptTemplate, collectionName: 'prompts' | 'design_prompts') => {
  try {
    await setDoc(doc(db, collectionName, prompt.id), prompt);
    console.log(`Saved prompt ${prompt.id} to Firestore`);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `${collectionName}/${prompt.id}`);
  }
};

const deletePromptFromFirestore = async (id: string, collectionName: 'prompts' | 'design_prompts') => {
  try {
    await deleteDoc(doc(db, collectionName, id));
    console.log(`Deleted prompt ${id} from Firestore`);
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `${collectionName}/${id}`);
  }
};

export default function App() {
  // --- Auth State ---
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('tomo_is_logged_in');
      return saved === 'true';
    } catch (e) {
      return false;
    }
  });

  const [userRole, setUserRole] = useState<'ADMIN' | 'TEACHER'>(() => {
    try {
      const saved = localStorage.getItem('tomo_user_role');
      return saved === 'TEACHER' ? 'TEACHER' : 'ADMIN';
    } catch (e) {
      return 'ADMIN';
    }
  });

  const [usernameInput, setUsernameInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // --- Mode State ---
  const [isAdminMode, setIsAdminMode] = useState<boolean>(() => {
    try {
      const savedRole = localStorage.getItem('tomo_user_role');
      if (savedRole === 'TEACHER') {
        return false;
      }
    } catch (e) {}
    return true; // Admin by default, but teacher starts in Teacher Mode.
  });

  // --- Common Prompt & Teacher States ---
  const [prompts, _setPrompts] = useState<PromptTemplate[]>(() => {
    try {
      const saved = localStorage.getItem('tomo_prompts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load prompts from localStorage:', e);
    }
    return INITIAL_PROMPTS;
  });

  const setPrompts = React.useCallback((updater: any) => {
    _setPrompts(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem('tomo_prompts', JSON.stringify(next));
      } catch (e) {
        console.error('Failed to save prompts to localStorage:', e);
      }
      return next;
    });
  }, []);

  // --- Active Domain State ('TEXT' for Writing, 'DESIGN' for Design) ---
  const [activeDomain, setActiveDomain] = useState<'TEXT' | 'DESIGN'>('TEXT');

  const [designPrompts, _setDesignPrompts] = useState<PromptTemplate[]>(() => {
    try {
      const saved = localStorage.getItem('tomo_design_prompts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load design prompts from localStorage:', e);
    }
    return INITIAL_DESIGN_PROMPTS;
  });

  const setDesignPrompts = React.useCallback((updater: any) => {
    _setDesignPrompts(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem('tomo_design_prompts', JSON.stringify(next));
      } catch (e) {
        console.error('Failed to save design prompts to localStorage:', e);
      }
      return next;
    });
  }, []);

  // --- Real-time Sync with Firestore ---
  React.useEffect(() => {
    // 1. Listen to text prompts from Firestore
    const unsubscribePrompts = onSnapshot(collection(db, 'prompts'), (snapshot) => {
      if (snapshot.empty) {
        // If Firestore prompts collection is empty, seed it with INITIAL_PROMPTS
        INITIAL_PROMPTS.forEach((p) => {
          setDoc(doc(db, 'prompts', p.id), p).catch(err => {
            handleFirestoreError(err, OperationType.CREATE, `prompts/${p.id}`);
          });
        });
      } else {
        const list: PromptTemplate[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as PromptTemplate);
        });
        list.sort((a, b) => {
          const dateA = a.createdAt || '';
          const dateB = b.createdAt || '';
          if (dateA !== dateB) {
            return dateB.localeCompare(dateA);
          }
          return (b.id || '').localeCompare(a.id || '');
        });
        _setPrompts(list);
        try {
          localStorage.setItem('tomo_prompts', JSON.stringify(list));
        } catch (e) {}
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'prompts');
    });

    // 2. Listen to design prompts from Firestore
    const unsubscribeDesign = onSnapshot(collection(db, 'design_prompts'), (snapshot) => {
      if (snapshot.empty) {
        // If Firestore design_prompts collection is empty, seed it with INITIAL_DESIGN_PROMPTS
        INITIAL_DESIGN_PROMPTS.forEach((p) => {
          setDoc(doc(db, 'design_prompts', p.id), p).catch(err => {
            handleFirestoreError(err, OperationType.CREATE, `design_prompts/${p.id}`);
          });
        });
      } else {
        const list: PromptTemplate[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as PromptTemplate);
        });
        list.sort((a, b) => {
          const dateA = a.createdAt || '';
          const dateB = b.createdAt || '';
          if (dateA !== dateB) {
            return dateB.localeCompare(dateA);
          }
          return (b.id || '').localeCompare(a.id || '');
        });
        _setDesignPrompts(list);
        try {
          localStorage.setItem('tomo_design_prompts', JSON.stringify(list));
        } catch (e) {}
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'design_prompts');
    });

    return () => {
      unsubscribePrompts();
      unsubscribeDesign();
    };
  }, []);

  const [teachers, setTeachers] = useState<Teacher[]>(INITIAL_TEACHERS);
  const [showToast, setShowToast] = useState<string | null>(null);

  // --- Drawer / Saved Prompts State (Teacher Mode) ---
  const [isSavedDrawerOpen, setIsSavedDrawerOpen] = useState<boolean>(false);
  const [archiveTab, setArchiveTab] = useState<'personal' | 'shared'>('personal');
  const [sharedFilter, setSharedFilter] = useState<'전체' | '공식 서식' | '우수 사례'>('전체');
  const [isDraggingCard, setIsDraggingCard] = useState<boolean>(false);
  const [movingPromptId, setMovingPromptId] = useState<string | null>(null);
  const [moveTargetDestination, setMoveTargetDestination] = useState<'personal' | 'shared'>('personal');
  const [moveTargetFolder, setMoveTargetFolder] = useState<string>('');

  const [savedUserPrompts, _setSavedUserPrompts] = useState<PromptTemplate[]>(() => {
    try {
      const saved = localStorage.getItem('tomo_saved_user_prompts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load savedUserPrompts from localStorage:', e);
    }
    return [];
  });

  const setSavedUserPrompts = React.useCallback((updater: any) => {
    _setSavedUserPrompts(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem('tomo_saved_user_prompts', JSON.stringify(next));
      } catch (e) {
        console.error('Failed to save savedUserPrompts to localStorage:', e);
      }
      return next;
    });
  }, []);

  const [sharedRepositoryPrompts, _setSharedRepositoryPrompts] = useState<{
    id: string;
    title: string;
    category: string;
    description: string;
    promptText: string;
    type: '공식 서식' | '우수 사례';
    author: string;
    downloads: number;
    sharedDate: string;
    status: '분류됨' | '미분류';
    isPinned?: boolean;
  }[]>(() => {
    try {
      const saved = localStorage.getItem('tomo_shared_repository_prompts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load sharedRepositoryPrompts from localStorage:', e);
    }
    return [];
  });

  const setSharedRepositoryPrompts = React.useCallback((updater: any) => {
    _setSharedRepositoryPrompts(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem('tomo_shared_repository_prompts', JSON.stringify(next));
      } catch (e) {
        console.error('Failed to save sharedRepositoryPrompts to localStorage:', e);
      }
      return next;
    });
  }, []);

  // --- Teacher Mode 3-Step Wizard States ---
  // Step 1: Template Curation, Step 2: Prompt Canvas, Step 3: Mega Prompt Generation
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);

  // Memoized current active database
  const activePrompts = useMemo(() => {
    return activeDomain === 'TEXT' ? prompts : designPrompts;
  }, [activeDomain, prompts, designPrompts]);

  const updateCurrentPrompts = (updater: any) => {
    if (activeDomain === 'TEXT') {
      setPrompts(updater);
    } else {
      setDesignPrompts(updater);
    }
  };

  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);

  // Unified Smart Mega Canvas Interactive States
  const [templateVersions, setTemplateVersions] = useState<Record<string, number>>({});
  const [versionControlEnabled, setVersionControlEnabled] = useState<boolean>(true);
  const [selectedTemplateWorkingVersion, setSelectedTemplateWorkingVersion] = useState<number>(1);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [variableDefaults, setVariableDefaults] = useState<Record<string, string>>({});

  // Centralized Governance Merger States
  const [selectedMergeSources, setSelectedMergeSources] = useState<string[]>([]);
  const [mergeTargetFolder, setMergeTargetFolder] = useState<string>('');
  const [mergeFolderType, setMergeFolderType] = useState<'personal' | 'shared'>('shared');
  const [newOfficialFolderInput, setNewOfficialFolderInput] = useState<string>('');
  
  const [teacherEditMode, setTeacherEditMode] = useState<'tags' | 'raw'>('tags');
  
  // Custom edit prompt state in Step 2 as Single Source of Truth
  const [canvasText, setCanvasText] = useState<string>('');
  const [activeTagIndex, setActiveTagIndex] = useState<number | null>(null);
  const [activeTagValue, setActiveTagValue] = useState<string>('');
  const [isTagCopied, setIsTagCopied] = useState<boolean>(false);
  const [isHoveringPanel, setIsHoveringPanel] = useState<boolean>(false);
  const [isPromptCopied, setIsPromptCopied] = useState<boolean>(false);
  const [lastCopiedTagValue, setLastCopiedTagValue] = useState<string | null>(null);

  useEffect(() => {
    setIsTagCopied(false);
  }, [activeTagIndex]);
  const [initialPromptText, setInitialPromptText] = useState<string>('');
  const [selectedTone, setSelectedTone] = useState<'다정하게' | '전문적으로'>('다정하게');
  const [selectedFormat, setSelectedFormat] = useState<'카드뉴스형' | '줄글형'>('줄글형');
  const [promptVolume, setPromptVolume] = useState<string>('A4 반 장 분량 (약 3~4문단)');
  const [isEditingVolume, setIsEditingVolume] = useState<boolean>(false);
  const [canvasSavedFeedback, setCanvasSavedFeedback] = useState<boolean>(false);

  // --- Save Destination Modal States for Step 3 Mega Prompt ---
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const [saveDocTitle, setSaveDocTitle] = useState<string>('');
  const [saveDestination, setSaveDestination] = useState<'personal' | 'shared'>('personal');

  // --- Save Destination Modal States for Step 2 Prompt Canvas ---
  const [isCanvasSaveModalOpen, setIsCanvasSaveModalOpen] = useState<boolean>(false);
  const [canvasSaveTitle, setCanvasSaveTitle] = useState<string>('');
  const [canvasSaveDestination, setCanvasSaveDestination] = useState<'personal' | 'shared'>('personal');
  const [canvasSaveSelectedFolder, setCanvasSaveSelectedFolder] = useState<string>('미분류');
  const [isCanvasSaveCreatingNewFolder, setIsCanvasSaveCreatingNewFolder] = useState<boolean>(false);
  const [canvasSaveNewFolderName, setCanvasSaveNewFolderName] = useState<string>('');
  const [personalFolders, _setPersonalFolders] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tomo_personal_folders');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (!parsed.includes('미분류')) {
            return ['미분류', ...parsed];
          }
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load personalFolders from localStorage:', e);
    }
    return ['미분류'];
  });

  const setPersonalFolders = React.useCallback((updater: any) => {
    _setPersonalFolders(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem('tomo_personal_folders', JSON.stringify(next));
      } catch (e) {
        console.error('Failed to save personalFolders to localStorage:', e);
      }
      return next;
    });
  }, []);

  const [sharedFolders, _setSharedFolders] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tomo_shared_folders');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (!parsed.includes('미분류')) {
            return ['미분류', ...parsed];
          }
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load sharedFolders from localStorage:', e);
    }
    return ['미분류'];
  });

  const setSharedFolders = React.useCallback((updater: any) => {
    _setSharedFolders(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem('tomo_shared_folders', JSON.stringify(next));
      } catch (e) {
        console.error('Failed to save sharedFolders to localStorage:', e);
      }
      return next;
    });
  }, []);

  const [selectedFolder, setSelectedFolder] = useState<string>('미분류');
  const [isCreatingNewFolder, setIsCreatingNewFolder] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [newExplorerFolderInput, setNewExplorerFolderInput] = useState<string>('');

  // Folder renaming and locking states
  const [lockedFolders, setLockedFolders] = useState<Record<string, boolean>>({
    '미분류': true,
  });
  const [editingFolder, setEditingFolder] = useState<{ type: 'personal' | 'shared'; name: string } | null>(null);
  const [editingFolderNameValue, setEditingFolderNameValue] = useState<string>('');
  const [activeMenuFolder, setActiveMenuFolder] = useState<{ type: 'personal' | 'shared'; name: string } | null>(null);
  const [activeCabinetFolderFilter, setActiveCabinetFolderFilter] = useState<string>('전체');

  // --- Protection & Restoration States ---
  const OFFICIAL_FOLDERS = [
    '가정통신문', '안내문', '공통 서식', '우수 사례', '교육 템플릿', '행정 서식',
    '학습지도안', '관찰일지', '학부모 상담'
  ];

  // Track folders modified by a teacher (created, renamed, deleted, or with items added)
  const [modifiedFolders, setModifiedFolders] = useState<Record<string, boolean>>({});

  // Background audit log of all folder modifications/actions by teachers
  const [auditLogs, setAuditLogs] = useState<{ id: string; timestamp: string; action: string; details: string; isTeacher: boolean }[]>([
    {
      id: 'log-init',
      timestamp: new Date().toLocaleTimeString('ko-KR', { hourCycle: 'h23' }),
      action: '시스템 초기화',
      details: '원내 지식정합성 표준 폴더 체제 가동 완료',
      isTeacher: false
    }
  ]);

  // Soft Confirmation Dialog state for renaming/deleting official folders
  const [softConfirm, setSoftConfirm] = useState<{
    isOpen: boolean;
    type: 'rename' | 'delete';
    folderType: 'personal' | 'shared';
    oldName: string;
    newName?: string; // used for rename
    onConfirm: () => void;
  } | null>(null);

  // Teacher Mode Filter States (Active & High density)
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>('원운영');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('전체');

  // --- Sub Categories Map with localStorage Persistence and Sync ---
  const [subCategoriesMap, setSubCategoriesMap] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('tomo_sub_categories');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load subcategories:', e);
    }
    return {
      '원운영': ['가정통신문'],
      '반운영': ['관찰일지', '학부모 상담'],
      '관찰/평가': ['관찰기록', '1학기 총평', '2학기 총평', '학기말 총평'],
      '기타': ['카드뉴스'],
      '지원자료': ['PPT', '학습지도안', '활동지', '영어 교육']
    };
  });

  const designSubCategoriesMap = useMemo<Record<string, string[]>>(() => ({
    '원운영': ['Canva', '배너', '행사/이벤트', '오리엔테이션', '학부모 교육', '가정통신문'],
    '반운영': ['Canva', '배너'],
    '관찰/평가': [],
    '기타': ['디자인', '인스타그램', '홍보/안내', '카드뉴스'],
    '지원자료': ['PPT레이아웃', '교구 제작']
  }), []);

  const currentSubCategoriesMap = useMemo(() => {
    return activeDomain === 'TEXT' ? subCategoriesMap : designSubCategoriesMap;
  }, [activeDomain, subCategoriesMap, designSubCategoriesMap]);

  const currentMainCategories = useMemo(() => {
    return ['원운영', '반운영', '관찰/평가', '기타', '지원자료'];
  }, []);

  const updateSubCategoriesMap = (newMap: Record<string, string[]>) => {
    setSubCategoriesMap(newMap);
    try {
      localStorage.setItem('tomo_sub_categories', JSON.stringify(newMap));
    } catch (e) {
      console.error('Failed to save subcategories:', e);
    }
  };

  // Sub Category Dynamic Manager Modal State
  const [isSubManagerOpen, setIsSubManagerOpen] = useState<boolean>(false);
  const [newSubInput, setNewSubInput] = useState<string>('');
  const [editingSubIndex, setEditingSubIndex] = useState<number | null>(null);
  const [editingSubValue, setEditingSubValue] = useState<string>('');

  // --- Admin Mode Navigation States ---
  const [adminTab, setAdminTab] = useState<'cms' | 'folders' | 'analytics'>('cms');
  const [logoClicks, setLogoClicks] = useState<number>(0);
  const [showSyncModal, setShowSyncModal] = useState<boolean>(false);
  
  // --- Admin CMS View Filters ---
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [explorerSearch, setExplorerSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [selectedTag, setSelectedTag] = useState<string>('전체');
  const [showHidden, setShowHidden] = useState<boolean>(true);
  const [selectedPromptStatsId, setSelectedPromptStatsId] = useState<string | null>(null);
  const [adminSortOption, setAdminSortOption] = useState<'newest' | 'oldest' | 'recentlyUpdated'>('newest');

  // --- Modal Form States for Admin Mode ---
  const [isNewPromptModalOpen, setIsNewPromptModalOpen] = useState<boolean>(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptTemplate | null>(null);
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState<boolean>(false);
  const [promptToDelete, setPromptToDelete] = useState<PromptTemplate | null>(null);
  
  // Form fields
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('가정통신문');
  const [formMainCategory, setFormMainCategory] = useState('');
  const [formSubCategory, setFormSubCategory] = useState('');
  const [isSubComboOpen, setIsSubComboOpen] = useState(false);
  const [formDescription, setFormDescription] = useState('');
  const [formPromptText, setFormPromptText] = useState('');
  const [formSystemGuidance, setFormSystemGuidance] = useState('');
  const [formCanvasTemplate, setFormCanvasTemplate] = useState('');
  const [formTags, setFormTags] = useState('');

  // --- Chart Section Customizer States ---
  const [activeChartView, setActiveChartView] = useState<'volume' | 'age' | 'custom'>('volume');
  const [isChartViewDropdownOpen, setIsChartViewDropdownOpen] = useState<boolean>(false);

  // --- Global Date Filter States ---
  const [globalYear, setGlobalYear] = useState<string>('2026');
  const [globalMonth, setGlobalMonth] = useState<string>('06');
  const [globalDay, setGlobalDay] = useState<string>('18');

  const dateSeed = useMemo(() => {
    const y = parseInt(globalYear, 10) || 2026;
    const m = parseInt(globalMonth, 10) || 6;
    const d = parseInt(globalDay, 10) || 18;
    return (y * 31 + m * 12 + d) % 97;
  }, [globalYear, globalMonth, globalDay]);

  // --- Gamification & Modal Interactions ---
  const [particles, setParticles] = useState<FlyingParticle[]>([]);
  const [isGiftModalOpen, setIsGiftModalOpen] = useState<boolean>(false);
  const [isStickerModalOpen, setIsStickerModalOpen] = useState<boolean>(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [institutionFilter, setInstitutionFilter] = useState<string>('전체');
  
  const [giftForm, setGiftForm] = useState({ prize: '🎁 스타벅스 아이스 아메리카노', title: '에듀테크 실천 감사 기프티콘' });
  const [stickerForm, setStickerForm] = useState({ sticker: '⭐ 에듀테크 마스터', comment: '탁월한 에듀테크 서비스 및 프롬프트 발굴로 교육 성장에 기여하셨습니다!' });

  // --- Gamification Send Handlers ---
  const handleSendGift = (teacherId: string, name: string) => {
    setSelectedTeacherId(teacherId);
    setGiftForm({
      prize: '🎁 스타벅스 아이스 아메리카노',
      title: `[${name} 교사] 에듀테크 실천 감사 기프티콘`
    });
    setIsGiftModalOpen(true);
  };

  const handleSendSticker = (teacherId: string, name: string) => {
    setSelectedTeacherId(teacherId);
    setStickerForm({
      sticker: '⭐ 에듀테크 마스터',
      comment: `[${name} 교사] 탁월한 에듀테크 서비스 및 프롬프트 발굴로 교육 성장에 기여하셨습니다!`
    });
    setIsStickerModalOpen(true);
  };

  const submitGift = (e: React.FormEvent) => {
    e.preventDefault();
    const targetTeacher = teachers.find(t => t.id === selectedTeacherId);
    if (targetTeacher) {
      triggerToast(`🎉 [${targetTeacher.name}] 선생님께 "${giftForm.prize}" 선물이 성공적으로 발송되었습니다!`);
    }
    setIsGiftModalOpen(false);
  };

  const submitSticker = (e: React.FormEvent) => {
    e.preventDefault();
    const targetTeacher = teachers.find(t => t.id === selectedTeacherId);
    if (targetTeacher) {
      setTeachers(prev => prev.map(t => {
        if (t.id === selectedTeacherId) {
          return {
            ...t,
            badge: stickerForm.sticker.replace('⭐', '').trim(),
            runs: t.runs + 1
          };
        }
        return t;
      }));
      triggerToast(`🏅 [${targetTeacher.name}] 선생님께 "${stickerForm.sticker}" 스티커가 정상적으로 발령되었습니다!`);
    }
    setIsStickerModalOpen(false);
  };

  // --- Telemetry Analytics State ---
  const [analyticsCopyVolume, setAnalyticsCopyVolume] = useState<number>(3482);
  const [analyticsEditVolume, setAnalyticsEditVolume] = useState<number>(1829);

  // Derived dynamically from selected global date controller parameters
  const dynamicCopyVolume = useMemo(() => {
    return analyticsCopyVolume + (dateSeed * 18) - 350;
  }, [analyticsCopyVolume, dateSeed]);

  const dynamicEditVolume = useMemo(() => {
    return analyticsEditVolume + (dateSeed * 9) - 165;
  }, [analyticsEditVolume, dateSeed]);

  const dynamicTeachersList = useMemo(() => {
    return teachers.map(t => {
      const baseShift = ((t.runs * dateSeed) % 35) - 15;
      return {
        ...t,
        runs: Math.max(8, t.runs + baseShift)
      };
    });
  }, [teachers, dateSeed]);

  // Trigger Toast Notification safely
  const triggerToast = (msg: string) => {
    setShowToast(msg);
    setTimeout(() => {
      setShowToast(null);
    }, 3000);
  };

  // Auth Handler Functions
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameInput === 'admin' && passwordInput === '1234') {
      setIsLoggedIn(true);
      setUserRole('ADMIN');
      setLoginError(null);
      localStorage.setItem('tomo_is_logged_in', 'true');
      localStorage.setItem('tomo_user_role', 'ADMIN');
      setIsAdminMode(true);
      triggerToast('👑 관리자 계정으로 로그인되었습니다!');
    } else if (usernameInput === 'teacher' && passwordInput === '1234') {
      setIsLoggedIn(true);
      setUserRole('TEACHER');
      setLoginError(null);
      localStorage.setItem('tomo_is_logged_in', 'true');
      localStorage.setItem('tomo_user_role', 'TEACHER');
      setIsAdminMode(false);
      triggerToast('🏡 교사 계정으로 로그인되었습니다!');
    } else {
      setLoginError('아이디 또는 비밀번호를 확인해 주세요');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserRole('ADMIN');
    setUsernameInput('');
    setPasswordInput('');
    localStorage.removeItem('tomo_is_logged_in');
    localStorage.removeItem('tomo_user_role');
    triggerToast('🔒 안전하게 로그아웃되었습니다.');
  };

  // Rename folder globally with soft-confirmation for official folders
  const renameFolder = (type: 'personal' | 'shared', oldName: string, newName: string) => {
    const cleanNewName = newName.trim();
    if (!cleanNewName) {
      triggerToast('⚠️ 폴더 이름을 입력해 주세요.');
      return;
    }
    if (oldName === cleanNewName) {
      return;
    }
    if (oldName === '미분류') {
      triggerToast('⚠️ 기본 폴더는 이름을 변경할 수 없습니다.');
      return;
    }

    if (OFFICIAL_FOLDERS.includes(oldName) || lockedFolders[oldName]) {
      setSoftConfirm({
        isOpen: true,
        type: 'rename',
        folderType: type,
        oldName,
        newName: cleanNewName,
        onConfirm: () => {
          executeRenameFolder(type, oldName, cleanNewName);
          setSoftConfirm(null);
        }
      });
    } else {
      executeRenameFolder(type, oldName, cleanNewName);
    }
  };

  const executeRenameFolder = (type: 'personal' | 'shared', oldName: string, cleanNewName: string) => {
    const isTeacher = !isAdminMode;
    const timestamp = new Date().toLocaleTimeString('ko-KR', { hourCycle: 'h23' });

    if (isTeacher) {
      setModifiedFolders(prev => ({ ...prev, [oldName]: true, [cleanNewName]: true }));
    }

    if (type === 'personal') {
      if (personalFolders.includes(cleanNewName)) {
        triggerToast('⚠️ 이미 존재하는 폴더 이름입니다.');
        return;
      }
      setPersonalFolders(prev => prev.map(f => f === oldName ? cleanNewName : f));
      setSavedUserPrompts(prev => prev.map(p => p.category === oldName ? { ...p, category: cleanNewName } : p));
      if (selectedFolder === oldName) setSelectedFolder(cleanNewName);
      if (activeCabinetFolderFilter === oldName) setActiveCabinetFolderFilter(cleanNewName);
      triggerToast(`📁 개인 폴더 [${oldName}]가 [${cleanNewName}]으로 일괄 변경되었습니다.`);
    } else {
      if (sharedFolders.includes(cleanNewName)) {
        triggerToast('⚠️ 이미 존재하는 폴더 이름입니다.');
        return;
      }
      setSharedFolders(prev => prev.map(f => f === oldName ? cleanNewName : f));
      setSharedRepositoryPrompts(prev => prev.map(p => p.category === oldName ? { ...p, category: cleanNewName } : p));
      if (selectedFolder === oldName) setSelectedFolder(cleanNewName);
      if (activeCabinetFolderFilter === oldName) setActiveCabinetFolderFilter(cleanNewName);
      triggerToast(`🌐 우리 원 폴더 [${oldName}]가 [${cleanNewName}]으로 일괄 전산 변경되었습니다.`);
    }

    setLockedFolders(prev => {
      const copy = { ...prev };
      if (copy[oldName]) {
        delete copy[oldName];
        copy[cleanNewName] = true;
      }
      return copy;
    });

    setAuditLogs(prev => [
      {
        id: `log-${Date.now()}`,
        timestamp,
        action: '폴더 개명',
        details: `${isTeacher ? '일선 교직원' : '행정 관리실'} 통제로 기존 [${oldName}] 폴더가 [${cleanNewName}]으로 개칭 일괄 전사 처리되었습니다.`,
        isTeacher
      },
      ...prev
    ]);
  };

  // Delete folder globally with soft-confirmation for official folders
  const deleteFolder = (type: 'personal' | 'shared', folderName: string) => {
    if (folderName === '미분류') {
      triggerToast('⚠️ [미분류] 기본 폴더는 절대 삭제할 수 없습니다.');
      return;
    }

    if (OFFICIAL_FOLDERS.includes(folderName) || lockedFolders[folderName]) {
      setSoftConfirm({
        isOpen: true,
        type: 'delete',
        folderType: type,
        oldName: folderName,
        onConfirm: () => {
          executeDeleteFolder(type, folderName);
          setSoftConfirm(null);
        }
      });
    } else {
      executeDeleteFolder(type, folderName);
    }
  };

  const executeDeleteFolder = (type: 'personal' | 'shared', folderName: string) => {
    const isTeacher = !isAdminMode;
    const timestamp = new Date().toLocaleTimeString('ko-KR', { hourCycle: 'h23' });

    if (isTeacher) {
      setModifiedFolders(prev => ({ ...prev, [folderName]: true }));
    }

    if (type === 'personal') {
      setPersonalFolders(prev => prev.filter(f => f !== folderName));
      setSavedUserPrompts(prev => prev.map(p => p.category === folderName ? { ...p, category: '미분류' } : p));
      if (selectedFolder === folderName) setSelectedFolder('미분류');
      if (activeCabinetFolderFilter === folderName) setActiveCabinetFolderFilter('전체');
      triggerToast(`🗑️ 개인용 폴더 [${folderName}]가 삭제 이송 처리되었습니다.`);
    } else {
      setSharedFolders(prev => prev.filter(f => f !== folderName));
      setSharedRepositoryPrompts(prev => prev.map(p => p.category === folderName ? { ...p, category: '미분류', status: '미분류' } : p));
      if (selectedFolder === folderName) setSelectedFolder('미분류');
      if (activeCabinetFolderFilter === folderName) setActiveCabinetFolderFilter('전체');
      triggerToast(`🗑️ 우리 원 공용 폴더 [${folderName}]가 소멸 철거 처리되었습니다.`);
    }

    setAuditLogs(prev => [
      {
        id: `log-${Date.now()}`,
        timestamp,
        action: '폴더 영구소멸',
        details: `${isTeacher ? '일선 교사' : '관리 사령탑'} 결정에 의해 [${folderName}] 폴더가 폐기되었고, 소장 템플릿들은 자동 안전지대인 [미분류]로 환원 이관되었습니다.`,
        isTeacher
      },
      ...prev
    ]);
  };

  // One-click Reset of folder structures to Admin's latest / Factory Standard Standard Layout
  const restoreFoldersToStandard = () => {
    setPersonalFolders(['미분류']);
    setSharedFolders(['미분류']);
    setLockedFolders({
      '미분류': true,
    });
    setModifiedFolders({});

    const timestamp = new Date().toLocaleTimeString('ko-KR', { hourCycle: 'h23' });
    setAuditLogs(prev => [
      {
        id: `restore-${Date.now()}`,
        timestamp,
        action: '표준체제 복원',
        details: '행정 통제소 원클릭 일괄 긴급 복위(Restore to Standard) 집행 완료. 모든 폴더 구조 및 규정잠금이 출하 기본형으로 환원되었습니다.',
        isTeacher: false
      },
      ...prev
    ]);

    triggerToast('⚙️ [Restore to Standard] 원클릭 복귀 행정명령으로 모든 폴더 구조와 보안이 원내 표준으로 자동 보정되었습니다.');
  };

  const toggleFolderLock = (folderName: string) => {
    setLockedFolders(prev => {
      const isCurrentlyLocked = !!prev[folderName];
      const updated = { ...prev, [folderName]: !isCurrentlyLocked };
      triggerToast(
        !isCurrentlyLocked
          ? `🔒 [${folderName}] 폴더가 공식 지정으로 지정 잠금되었습니다.`
          : `🔓 [${folderName}] 폴더의 잠금이 수동 해제되어 자율 편집을 허용합니다.`
      );
      return updated;
    });
  };

  // Helper inside click handlers to spawn lovely dynamic particle stickers
  const triggerParticles = (emojis: string[], clientX: number, clientY: number) => {
    const parent = document.getElementById('root');
    const rootLeft = parent?.getBoundingClientRect().left || 0;
    const rootTop = parent?.getBoundingClientRect().top || 0;
    
    // Spawn particles in random upward trajectories
    const newParticles: FlyingParticle[] = Array.from({ length: 15 }).map((_, i) => ({
      id: Date.now() + i,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      x: clientX - rootLeft + (Math.random() * 40 - 20),
      y: clientY - rootTop - (Math.random() * 10),
      rotation: Math.random() * 360,
      scale: 0.6 + Math.random() * 0.8,
    }));

    setParticles(prev => [...prev, ...newParticles]);

    // Clean up particles
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
    }, 1500);
  };

  // Splits text by square brackets [name] and balanced curly braces {name}, supporting nested braces.
  const splitBySmartTags = (text: string): string[] => {
    if (!text) return [];
    const parts: string[] = [];
    let currentPlain = '';
    let i = 0;
    while (i < text.length) {
      if (text[i] === '[') {
        if (currentPlain) {
          parts.push(currentPlain);
          currentPlain = '';
        }
        let bracketContent = '[';
        i++;
        let bracketDepth = 1;
        while (i < text.length && bracketDepth > 0) {
          const char = text[i];
          bracketContent += char;
          if (char === '[') {
            bracketDepth++;
          } else if (char === ']') {
            bracketDepth--;
          }
          i++;
        }
        parts.push(bracketContent);
      } else if (text[i] === '{') {
        if (currentPlain) {
          parts.push(currentPlain);
          currentPlain = '';
        }
        let braceContent = '{';
        i++;
        let depth = 1;
        while (i < text.length && depth > 0) {
          const char = text[i];
          braceContent += char;
          if (char === '{') {
            depth++;
          } else if (char === '}') {
            depth--;
          }
          i++;
        }
        parts.push(braceContent);
      } else {
        currentPlain += text[i];
        i++;
      }
    }
    if (currentPlain) {
      parts.push(currentPlain);
    }
    return parts;
  };

  // Cleans tag labels from unmatched/unbalanced leading/trailing curly braces
  const cleanTagLabel = (label: string): string => {
    let cleaned = label.trim();
    let openCount = 0;
    let closeCount = 0;
    for (let char of cleaned) {
      if (char === '{') openCount++;
      if (char === '}') closeCount++;
    }
    while (openCount !== closeCount) {
      if (openCount > closeCount && cleaned.startsWith('{')) {
        cleaned = cleaned.slice(1).trim();
        openCount--;
      } else if (closeCount > openCount && cleaned.endsWith('}')) {
        cleaned = cleaned.slice(0, -1).trim();
        closeCount--;
      } else if (openCount > closeCount && cleaned.endsWith('{')) {
        cleaned = cleaned.slice(0, -1).trim();
        openCount--;
      } else if (closeCount > openCount && cleaned.startsWith('}')) {
        cleaned = cleaned.slice(1).trim();
        closeCount--;
      } else {
        break;
      }
    }
    return cleaned;
  };

  // Cleans slot labels from unmatched/unbalanced leading/trailing brackets
  const cleanSlotLabel = (label: string): string => {
    let cleaned = label.trim();
    let openCount = 0;
    let closeCount = 0;
    for (let char of cleaned) {
      if (char === '[') openCount++;
      if (char === ']') closeCount++;
    }
    while (openCount !== closeCount) {
      if (openCount > closeCount && cleaned.startsWith('[')) {
        cleaned = cleaned.slice(1).trim();
        openCount--;
      } else if (closeCount > openCount && cleaned.endsWith(']')) {
        cleaned = cleaned.slice(0, -1).trim();
        closeCount--;
      } else {
        break;
      }
    }
    return cleaned;
  };

  // Parses and converts double curly braces {{key: defaultValue}} into single curly braces {defaultValue}
  const normalizeDoubleCurlyBraces = (text: string): string => {
    if (!text) return '';
    let result = '';
    let i = 0;
    while (i < text.length) {
      if (text[i] === '{' && text[i + 1] === '{') {
        let start = i;
        i += 2;
        let inner = '';
        let singleBraceDepth = 0;
        while (i < text.length) {
          if (text[i] === '{' && text[i + 1] === '{') {
            inner += '{{';
            i += 2;
          } else if (text[i] === '}' && text[i + 1] === '}') {
            if (singleBraceDepth === 0) {
              i += 2;
              break;
            } else {
              inner += '}}';
              i += 2;
            }
          } else {
            if (text[i] === '{') singleBraceDepth++;
            if (text[i] === '}') singleBraceDepth--;
            inner += text[i];
            i++;
          }
        }
        const parts = inner.split(':');
        const key = parts[0].trim();
        const defaultValue = parts.slice(1).join(':').trim();
        const finalVal = defaultValue ? defaultValue : key;
        result += `{${finalVal}}`;
      } else {
        result += text[i];
        i++;
      }
    }
    return result;
  };

  // Strips outermost single curly braces {...} for compiler output, handling nested braces correctly
  const stripOuterBraces = (text: string): string => {
    let result = '';
    let i = 0;
    while (i < text.length) {
      if (text[i] === '{') {
        let depth = 1;
        let start = i;
        i++;
        while (i < text.length && depth > 0) {
          if (text[i] === '{') depth++;
          else if (text[i] === '}') depth--;
          i++;
        }
        const content = text.slice(start + 1, i - 1);
        result += content;
      } else {
        result += text[i];
        i++;
      }
    }
    return result;
  };

  // Helper to parse variables inside double curly braces {{name}} or square brackets [name]
  const parseVariables = (text: string) => {
    const regexDouble = /\{\{([^}]+)\}\}/g;
    const regexSquare = /\[([가-힣a-zA-Z0-9_\s]{2,12})\]/g;
    const matches: { full: string; name: string; defaultValue: string; isSquare?: boolean }[] = [];
    
    let match;
    while ((match = regexDouble.exec(text)) !== null) {
      const full = match[0];
      const inner = match[1];
      const parts = inner.split(':');
      const name = parts[0].trim();
      const defaultValue = parts[1] ? parts[1].trim() : '';
      if (!matches.some(m => m.name === name)) {
        matches.push({ full, name, defaultValue });
      }
    }
    
    while ((match = regexSquare.exec(text)) !== null) {
      const full = match[0];
      const name = match[1].trim();
      const excludes = ['되돌리기', '복사하기', '내 문서함에 저장', 'Restore to Standard'];
      if (!excludes.includes(name) && !matches.some(m => m.name === name)) {
        matches.push({ full, name, defaultValue: '', isSquare: true });
      }
    }
    return matches;
  };

  // Helper to resolve and compile raw prompt text with filled variables
  const getCompiledText = (rawText: string) => {
    let result = rawText;
    const vars = parseVariables(rawText);
    
    vars.forEach(m => {
      const userValue = variableValues[m.name];
      const replacementValue = (userValue !== undefined && userValue !== '') ? userValue : (m.defaultValue || m.name);
      result = result.replaceAll(m.full, replacementValue);
    });

    // Strip single curly braces {...} for compiler output, handling nested braces correctly
    result = stripOuterBraces(result);

    return result;
  };

  const handleTagUpdate = (indexToUpdate: number, newVal: string) => {
    const parts = splitBySmartTags(canvasText);
    if (indexToUpdate >= 0 && indexToUpdate < parts.length) {
      parts[indexToUpdate] = `{${newVal}}`;
      const updated = parts.join('');
      setCanvasText(updated);
      setActiveTagIndex(null);
      triggerToast(`✏️ 스마트 태그가 '${newVal}'(으)로 최종 변경 및 동기화되었습니다.`);
    }
  };

  const handleTagUpdateWithoutClosing = (indexToUpdate: number, newVal: string) => {
    const parts = splitBySmartTags(canvasText);
    if (indexToUpdate >= 0 && indexToUpdate < parts.length) {
      parts[indexToUpdate] = `{${newVal}}`;
      const updated = parts.join('');
      setCanvasText(updated);
    }
  };

  const checkIfTagIsCopyable = (tagIndex: number | null) => {
    if (tagIndex === null || tagIndex === undefined) return false;
    const parts = splitBySmartTags(canvasText);
    if (tagIndex <= 0 || tagIndex >= parts.length) return false;

    // Get the plain text immediately preceding this tag
    const precedingText = parts[tagIndex - 1];
    if (!precedingText) return false;

    // Clean preceding text to extract the last label/key right before the tag
    const cleaned = precedingText.trim().replace(/[\s\:\-\n\r]+$/, "");
    const lastToken = cleaned.split(/[\s\n\r]+/).pop() || "";

    // Strictly match 1-2 digits followed by "페이지", e.g., 1페이지, 2페이지, 10페이지
    const pageRegex = /^[0-9]{1,2}페이지$/;
    return pageRegex.test(lastToken);
  };

  const shouldShowCopyButton = () => {
    if (activeTagIndex === null) return false;
    return checkIfTagIsCopyable(activeTagIndex);
  };

  const getTargetPromptToCopy = () => {
    if (activeTagIndex !== null && shouldShowCopyButton()) {
      return activeTagValue;
    }
    if (lastCopiedTagValue) {
      return lastCopiedTagValue;
    }
    return assembledMegaPrompt;
  };

  const handleCopyActiveTagText = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    console.log("🔥하단 단독 복사 실행됨", activeTagValue);
    const systemGuidance = (selectedTemplate?.systemGuidance || '').trim();
    const textToCopy = systemGuidance
      ? `${systemGuidance}\n\n[현재 페이지 상세 요청]\n${activeTagValue}`
      : `[현재 페이지 상세 요청]\n${activeTagValue}`;
    navigator.clipboard.writeText(textToCopy);
    setLastCopiedTagValue(activeTagValue);
    setIsTagCopied(true);
    triggerToast('📄 입력창의 현재 텍스트가 클립보드에 복사되었습니다.');
  };

  const handleActiveDomainChange = (domain: 'TEXT' | 'DESIGN') => {
    setActiveDomain(domain);
    setLastCopiedTagValue(null);
    
    const list = domain === 'TEXT' ? prompts : designPrompts;
    const isCurrentTemplateValid = selectedTemplate && list.some(p => p.id === selectedTemplate.id);
    
    if (!isCurrentTemplateValid) {
      setSelectedTemplate(null);
      setCanvasText('');
      setInitialPromptText('');
      setVariableValues({});
      setVariableDefaults({});
    }

    setSelectedMainCategory('원운영');
    setSelectedSubCategory('전체');
  };

  // Switch to State 2 inside the Wizard from a template click
  const selectTemplateAndGoToCanvas = (template: PromptTemplate) => {
    setSelectedTemplate(template);
    setLastCopiedTagValue(null);
    setIsPromptCopied(false);
    const textToLoad = template.canvasTemplate ?? template.promptText;
    const normalizedText = normalizeDoubleCurlyBraces(textToLoad);
    setCanvasText(normalizedText);
    setInitialPromptText(normalizedText);
    setWizardStep(2);
    
    // Determine the standard version
    const latestVersion = templateVersions[template.id] || 1;
    setSelectedTemplateWorkingVersion(latestVersion);

    // Initialize smart variables
    const vars = parseVariables(textToLoad);
    const initialVals: Record<string, string> = {};
    vars.forEach(v => {
      initialVals[v.name] = v.defaultValue;
    });
    setVariableValues(initialVals);
    setVariableDefaults(initialVals);

    triggerToast(`🎯 [${template.title}] 템플릿이 조립용 캠퍼스에 연동되었습니다.`);
  };

  // Generate Mega Prompt text combining base + tone + format
  const assembledMegaPrompt = useMemo(() => {
    if (!selectedTemplate) return '';
    
    // Get the absolute latest canvas text, incorporating the active tag being edited right now
    let latestCanvasText = canvasText;
    if (teacherEditMode === 'tags' && activeTagIndex !== null) {
      const parts = splitBySmartTags(canvasText);
      if (activeTagIndex >= 0 && activeTagIndex < parts.length) {
        parts[activeTagIndex] = `{${activeTagValue}}`;
        latestCanvasText = parts.join('');
      }
    }

    const compiledBody = getCompiledText(latestCanvasText);
    const sysGuidance = (selectedTemplate.systemGuidance || '').trim();

    if (sysGuidance) {
      return `${sysGuidance}\n\n${compiledBody}`;
    }

    return compiledBody;
  }, [selectedTemplate, canvasText, variableValues, teacherEditMode, activeTagIndex, activeTagValue]);

  // Handle Admin CRUD or Edit Form Opening
  const openNewPromptModal = (promptToEdit: PromptTemplate | null = null) => {
    if (promptToEdit) {
      setEditingPrompt(promptToEdit);
      setFormTitle(promptToEdit.title);
      setFormCategory(promptToEdit.category);
      
      const mainCat = promptToEdit.mainCategory || (
        ['PPT', '학습지도안', '활동지', '영어 교육'].includes(promptToEdit.category) ? '지원자료' :
        ['가정통신문'].includes(promptToEdit.category) ? '원운영' :
        ['관찰일지', '학부모 상담'].includes(promptToEdit.category) ? '반운영' :
        ['카드뉴스'].includes(promptToEdit.category) ? '기타' : ''
      );
      setFormMainCategory(mainCat);
      setFormSubCategory(promptToEdit.category);
      setIsSubComboOpen(false);

      setFormDescription(promptToEdit.description);
      setFormPromptText(promptToEdit.promptText);
      setFormSystemGuidance(promptToEdit.systemGuidance || '');
      setFormCanvasTemplate(promptToEdit.canvasTemplate || promptToEdit.promptText);
      setFormTags(promptToEdit.tags.join(', '));
    } else {
      setEditingPrompt(null);
      setFormTitle('');
      setFormCategory('가정통신문');
      setFormMainCategory('');
      setFormSubCategory('');
      setIsSubComboOpen(false);
      setFormDescription('');
      setFormPromptText('');
      setFormSystemGuidance('');
      setFormCanvasTemplate('');
      setFormTags('');
    }
    setIsNewPromptModalOpen(true);
  };

  const saveAdminPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formCanvasTemplate.trim()) {
      triggerToast('⚠️ 필수 값(*)들을 채워주십시오.');
      return;
    }

    if (!formMainCategory) {
      triggerToast('⚠️ 대분류(Main Category)를 먼저 선택해주세요!');
      return;
    }

    if (!formSubCategory.trim()) {
      triggerToast('⚠️ 하위 카테고리(Sub Category)를 입력하거나 선택해주세요!');
      return;
    }

    const finalCategory = formSubCategory.trim();
    const finalMainCategory = formMainCategory;

    const tagsArray = formTags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const savedPromptId = editingPrompt ? editingPrompt.id : 'p-' + Date.now();

    // Increment standard template version for governance
    setTemplateVersions(prev => ({
      ...prev,
      [savedPromptId]: (prev[savedPromptId] || 1) + 1
    }));

    const mergedPromptText = formSystemGuidance.trim()
      ? `${formSystemGuidance.trim()}\n\n${formCanvasTemplate.trim()}`
      : formCanvasTemplate.trim();

    if (editingPrompt) {
      // Modify existing
      const updatedPrompt = {
        ...editingPrompt,
        title: formTitle,
        category: finalCategory,
        mainCategory: finalMainCategory,
        description: formDescription,
        promptText: mergedPromptText,
        systemGuidance: formSystemGuidance.trim(),
        canvasTemplate: formCanvasTemplate.trim(),
        tags: tagsArray.length > 0 ? tagsArray : [finalCategory],
        updatedAt: new Date().toISOString().split('T')[0]
      };
      updateCurrentPrompts((prev: PromptTemplate[]) => prev.map(p => {
        if (p.id === editingPrompt.id) {
          return updatedPrompt;
        }
        return p;
      }));
      savePromptToFirestore(updatedPrompt, activeDomain === 'TEXT' ? 'prompts' : 'design_prompts');
      triggerToast('🎯 프롬프트 정보가 최신 버전(v' + ((templateVersions[savedPromptId] || 1) + 1) + '.0)으로 수정 및 정식 빌드 배포되었습니다.');
    } else {
      // New
      const newPrompt: PromptTemplate = {
        id: savedPromptId,
        title: formTitle,
        category: finalCategory,
        mainCategory: finalMainCategory,
        description: formDescription,
        promptText: mergedPromptText,
        systemGuidance: formSystemGuidance.trim(),
        canvasTemplate: formCanvasTemplate.trim(),
        tags: tagsArray.length > 0 ? tagsArray : [finalCategory],
        runs: 0,
        satisfaction: 95,
        efficiency: 85,
        isHidden: false,
        createdAt: new Date().toISOString().split('T')[0]
      };
      updateCurrentPrompts((prev: PromptTemplate[]) => [newPrompt, ...prev]);
      savePromptToFirestore(newPrompt, activeDomain === 'TEXT' ? 'prompts' : 'design_prompts');
      triggerToast('✨ 신규 교육용 프롬프트 메타가 CMS 라이브러리에 주입 개정 배포되었습니다.');
    }
    setIsNewPromptModalOpen(false);
  };

  // Inline actions from Admin CMS View
  const handleToggleHide = (id: string) => {
    updateCurrentPrompts((prev: PromptTemplate[]) => prev.map(p => {
      if (p.id === id) {
        const nextHidden = !p.isHidden;
        triggerToast(nextHidden ? '🔒 [숨김] 프롬프트가 교실 환경 일람에서 숨겨졌습니다.' : '🔓 [보임] 교사 전용 프롬프트 선택지에 다시 노출됩니다.');
        const updatedPrompt = { ...p, isHidden: nextHidden };
        savePromptToFirestore(updatedPrompt, activeDomain === 'TEXT' ? 'prompts' : 'design_prompts');
        return updatedPrompt;
      }
      return p;
    }));
  };

  const handleAdminDelete = (id: string) => {
    const target = activePrompts.find(p => p.id === id);
    if (target) {
      setPromptToDelete(target);
      setIsDeleteConfirmModalOpen(true);
    }
  };

  const confirmAdminDelete = () => {
    if (promptToDelete) {
      updateCurrentPrompts((prev: PromptTemplate[]) => prev.filter(p => p.id !== promptToDelete.id));
      deletePromptFromFirestore(promptToDelete.id, activeDomain === 'TEXT' ? 'prompts' : 'design_prompts');
      triggerToast('🗑️ 지정된 프롬프트가 영구 삭제 및 기각되었습니다.');
      setIsDeleteConfirmModalOpen(false);
      setPromptToDelete(null);
    }
  };

  // CSV Data Export Verbatim [CSV 원시 데이터 추출] or [CSV 데이터 내보내기]
  const handleCsvDataExport = () => {
    try {
      const headers = `조회_기준일자,${globalYear ?? '2026'}-${globalMonth ?? '06'}-${globalDay ?? '18'}\nID,프롬프트_템플릿명,대과목_대분류,사용자_실행량,만평_도달성공률\n`;
      const rows = activePrompts.map(p => {
        const shift = ((p.runs * (dateSeed ?? 0)) % 15) - 7;
        const dynamicRuns = Math.max(0, p.runs + shift);
        return `"${p.id}","${p.title}","${p.category}",${dynamicRuns},${p.satisfaction}%`;
      }).join('\n');

      const csvContent = '\uFEFF' + headers + rows;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Tomo_Admin_Analytical_Logs_${globalYear ?? '2026'}-${globalMonth ?? '06'}-${globalDay ?? '18'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      triggerToast(`📊 [CSV 원시 데이터 추출] (${globalYear ?? '2026'}-${globalMonth ?? '06'}-${globalDay ?? '18'} 기준)이 완벽하게 추출되었습니다!`);
    } catch (e) {
      triggerToast('데이터 변환 중 예기치 못한 이슈가 발생했습니다.');
    }
  };

  // Filter computation for Admin Grid
  const filteredAdminPrompts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const hasSearch = query.length > 0;

    const filtered = activePrompts.filter(p => {
      // 1. matchSearch: Global search matching title, description, category (sub-category), promptText, tags
      let matchSearch = true;
      if (hasSearch) {
        matchSearch =
          p.title.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          (p.category || '').toLowerCase().includes(query) ||
          (p.promptText || '').toLowerCase().includes(query) ||
          (p.tags || []).some(t => t.toLowerCase().includes(query));
      }

      // 2. matchMain (ignored if hasSearch is true)
      let matchMain = true;
      if (!hasSearch) {
        const listForMain = (currentSubCategoriesMap[selectedMainCategory] || []).map(s => s.replace(/^#/, '').trim().toLowerCase());
        matchMain = isLooseMatch(p.mainCategory || '', selectedMainCategory) || 
                    (!p.mainCategory && (
                      isLooseMatch(p.category || '', selectedMainCategory) ||
                      listForMain.some(subItem => isLooseMatch(p.category || '', subItem))
                    ));
      }

      // 3. matchSub (ignored if hasSearch is true)
      let matchSub = true;
      if (!hasSearch && selectedSubCategory !== '전체') {
        const cleanSub = selectedSubCategory.replace(/^#/, '').trim().toLowerCase();
        const catMatches = isLooseMatch(p.category || '', cleanSub);
        const tagMatches = (p.tags || []).some(tag => isLooseMatch(tag, cleanSub));
        matchSub = catMatches || tagMatches;
      }

      // 4. matchVisibility
      const matchVisibility = showHidden ? true : !p.isHidden;

      return matchSearch && matchMain && matchSub && matchVisibility;
    });

    return [...filtered].sort((a, b) => {
      if (adminSortOption === 'newest') {
        const dateA = a.createdAt || '';
        const dateB = b.createdAt || '';
        if (dateA !== dateB) {
          return dateB.localeCompare(dateA);
        }
        return (b.id || '').localeCompare(a.id || '');
      } else if (adminSortOption === 'oldest') {
        const dateA = a.createdAt || '';
        const dateB = b.createdAt || '';
        if (dateA !== dateB) {
          return dateA.localeCompare(dateB);
        }
        return (a.id || '').localeCompare(b.id || '');
      } else if (adminSortOption === 'recentlyUpdated') {
        const dateA = a.updatedAt || a.createdAt || '';
        const dateB = b.updatedAt || b.createdAt || '';
        if (dateA !== dateB) {
          return dateB.localeCompare(dateA);
        }
        return (b.id || '').localeCompare(a.id || '');
      }
      return 0;
    });
  }, [activePrompts, searchQuery, selectedMainCategory, selectedSubCategory, showHidden, currentSubCategoriesMap, adminSortOption]);

  // Save to Pocket/Keeper List ([내 보관함] 저장하기)
  const saveToDrawerMyPocket = (templateItem: PromptTemplate) => {
    if (savedUserPrompts.find(item => item.id === templateItem.id)) {
      triggerToast('💡 이미 내 보관함에 즐겨찾기 저장 상태로 수납되어 있습니다.');
    } else {
      setSavedUserPrompts(prev => [templateItem, ...prev]);
      triggerToast('⭐ 특별 보관함 서랍에 즐겨찾기가 신규 완수되었습니다.');
    }
  };

  const removeFromDrawerMyPocket = (id: string) => {
    setSavedUserPrompts(prev => prev.filter(item => item.id !== id));
    triggerToast('🗑️ 보관함 서랍에서 지표를 비웠습니다.');
  };

  const promoteToSharedRepository = (p: PromptTemplate, clientX?: number, clientY?: number) => {
    const alreadyExists = sharedRepositoryPrompts.some(
      item => item.title === `🌟 [우수사례] ${p.title}` || item.promptText === p.promptText
    );
    if (alreadyExists) {
      triggerToast('💡 이미 우리 원 문서함에 우수 사례로 공유 완료되었습니다.');
      return;
    }

    const newSharedItem = {
      id: `shared-user-${p.id || 'item'}-${Date.now()}`,
      title: `🌟 [우수사례] ${p.title}`,
      category: '미분류',
      description: `${p.description} (교직원 추천 지식 자산)`,
      promptText: p.promptText,
      type: '우수 사례' as const,
      author: '전소은 교사',
      downloads: 0,
      sharedDate: '2026-06-19',
      status: '미분류' as const,
      isPinned: false
    };

    setSharedRepositoryPrompts(prev => [newSharedItem, ...prev]);

    // Fireworks particles and positive alert toast
    const numParticles = 22;
    const tempParticles: FlyingParticle[] = [];
    const sx = clientX || (typeof window !== 'undefined' ? window.innerWidth / 2 : 400);
    const sy = clientY || (typeof window !== 'undefined' ? window.innerHeight / 2 : 400);
    
    for (let i = 0; i < numParticles; i++) {
      tempParticles.push({
        id: Date.now() + i,
        emoji: ['🎉', '🌐', '📁', '⭐', '✨', '🧠'][Math.floor(Math.random() * 6)],
        x: sx,
        y: sy,
        rotation: Math.random() * 360,
        scale: Math.random() * 0.4 + 0.8
      });
    }
    setParticles(prev => [...prev, ...tempParticles]);

    setArchiveTab('shared'); // Transition seamlessly to the shared repository tab to show the user's action
    triggerToast(`🌐 [내 작업실] ➔ [우리 원 문서함] 지식 전파 및 공유가 성공적으로 완료되었습니다!`);
  };

  const handleClassify = (docId: string, targetCategory: string) => {
    setSharedRepositoryPrompts(prev => prev.map(item => {
      if (item.id === docId) {
        return {
          ...item,
          category: targetCategory,
          status: '분류됨' as const
        };
      }
      return item;
    }));
    
    // We can fetch the title from active state
    setSharedRepositoryPrompts(prev => {
      const doc = prev.find(item => item.id === docId);
      if (doc) {
        triggerToast(`📂 [${doc.title.replace('🌱 ', '').replace('📖 ', '').replace('🌟 [우수사례] ', '')}]가 [${targetCategory}] 편제 폴더함으로 완수 이동되었습니다!`);
      }
      return prev;
    });
  };

  // Open external simulated AI window while duplicating
  const copyAndOpenExternalAI = (textToSend: string, event: React.MouseEvent) => {
    navigator.clipboard.writeText(textToSend);
    triggerParticles(['🚀', '🔮', '✨', '🔥', '💻'], event.clientX, event.clientY);
    
    // Increment the Clipboard Copy Rate metric for the stats
    setAnalyticsCopyVolume(prev => prev + 1);
    
    triggerToast('📋 메가 프롬프트가 클립보드에 초고속 복사되었습니다!');
    
    // Simulate dialog showing the external service opening options
    setTimeout(() => {
      if (window.confirm('복사 성공! Google AI 스튜디오 또는 클라우드 어시스턴트로 원활히 연관 지시할 수 있게 외부 테스트 베드를 열어드릴까요?')) {
        window.open('https://aistudio.google.com/', '_blank');
      }
    }, 200);
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50/30 p-4 md:p-8 font-sans select-none relative overflow-hidden">
        {/* Soft elegant background glowing circles */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#001C3D]/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#FFD93D]/5 rounded-full blur-3xl" />

        <div className="w-full max-w-xl z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white rounded-3xl p-8 md:p-12 shadow-2xl border border-slate-100 space-y-8 relative"
          >
            {/* Header / Brand */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
              <div className="select-none">
                <img
                  src={aiGoLogo}
                  alt="Tomo AI Go Logo"
                  className="w-[180px] h-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                <span>도움이 필요하신가요?</span>
                <a href="mailto:support@tomoai.com" className="text-[#001C3D] hover:underline flex items-center gap-0.5 font-bold">
                  문의하기 <ExternalLink className="w-3 h-3 inline" />
                </a>
              </div>
            </div>

            {/* Title & Slogan */}
            <div className="space-y-2">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                반갑습니다! 👋
              </h2>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">
                발급받은 계정으로 로그인해 주세요.
              </p>
            </div>

            {/* Error Message */}
            {loginError && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-rose-50 border border-rose-100 text-[#FF6B6B] rounded-2xl flex items-center gap-3 text-xs font-black shadow-sm"
              >
                <AlertTriangle className="w-5 h-5 shrink-0 text-[#FF6B6B]" />
                <span>{loginError}</span>
              </motion.div>
            )}

            {/* Login Inputs Form */}
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-slate-700 pl-1">
                  아이디
                </label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 group-focus-within:text-[#001C3D] transition-colors">
                    <Users className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type="text"
                    required
                    value={usernameInput}
                    onChange={(e) => {
                      setUsernameInput(e.target.value);
                      if (loginError) setLoginError(null);
                    }}
                    placeholder="아이디를 입력하세요"
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-[#001C3D] focus:ring-4 focus:ring-[#001C3D]/5 rounded-2xl text-sm font-semibold text-slate-800 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between pl-1">
                  <label className="block text-xs font-extrabold text-slate-700">
                    비밀번호
                  </label>
                </div>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 group-focus-within:text-[#001C3D] transition-colors">
                    <Lock className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      if (loginError) setLoginError(null);
                    }}
                    placeholder="비밀번호를 입력하세요"
                    className="w-full pl-12 pr-12 py-3.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-[#001C3D] focus:ring-4 focus:ring-[#001C3D]/5 rounded-2xl text-sm font-semibold text-slate-800 transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-[#001C3D] hover:bg-[#002B5C] text-white font-black text-sm rounded-2xl transition-all shadow-md hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 mt-2 cursor-pointer"
              >
                <span>안전하게 로그인하기</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Test Credentials Guide (Web Style Card Grid) */}
            <div className="pt-6 border-t border-dashed border-slate-100">
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 text-xs text-slate-600 space-y-3 leading-relaxed">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-[#FFD93D]/10 text-[#cca600] rounded-md shrink-0">
                    <Info className="w-4 h-4" />
                  </div>
                  <span className="font-extrabold text-slate-800 text-[13px]">
                    테스트 시연용 인증 계정 정보
                  </span>
                </div>
                <p className="text-slate-500 font-medium leading-relaxed pl-1">
                  아래의 사전 제공된 역할별 가상 계정 정보를 사용하여 서비스의 세분화된 맞춤 기능들을 즉각 테스트해 볼 수 있습니다.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div className="p-3 bg-white border border-slate-200/60 rounded-xl hover:border-slate-300 transition-all shadow-sm">
                    <div className="font-bold text-xs text-[#001C3D] flex items-center gap-1.5 mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#001C3D]" />
                      관리자 (ADMIN)
                    </div>
                    <div className="text-[11px] text-slate-500 space-y-0.5 font-medium font-mono">
                      <div>ID: <strong className="text-slate-800">admin</strong></div>
                      <div>PW: <strong className="text-slate-800">1234</strong></div>
                    </div>
                  </div>

                  <div className="p-3 bg-white border border-slate-200/60 rounded-xl hover:border-slate-300 transition-all shadow-sm">
                    <div className="font-bold text-xs text-[#FF6B6B] flex items-center gap-1.5 mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B6B]" />
                      교사 (TEACHER)
                    </div>
                    <div className="text-[11px] text-slate-500 space-y-0.5 font-medium font-mono">
                      <div>ID: <strong className="text-slate-800">teacher</strong></div>
                      <div>PW: <strong className="text-slate-800">1234</strong></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Warning/Footer */}
            <div className="text-center text-[11px] text-slate-400 font-semibold pt-4 border-t border-slate-100">
              © 2026 Tomo AI Go. 본 시스템은 최신 기계 학습 지원 도구 및 암호 규격을 적용받고 있습니다.
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen overflow-hidden flex flex-col font-sans transition-colors duration-500 selection:bg-[#FF6B6B]/20 ${
      isAdminMode ? 'bg-[#F5F7FA] text-slate-800' : 'bg-[#FAF8F5] text-[#141414]'
    }`} id="tomo-root-container">
      
      {/* 1. GLOBAL HEADER COMPONENT (Always persistent on top) */}
      <header
        className="h-16 bg-white border-b border-slate-100 shadow-md fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 select-none"
        id="tomo-universal-header"
      >
        {/* Left Area: Branding logo and logo text */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#001C3D] rounded-xl flex items-center justify-center text-white shadow-md cursor-pointer hover:rotate-12 transition-transform duration-300">
            <span className="font-rounded font-black tracking-tighter text-base">토</span>
          </div>
          <span className="font-extrabold text-[#001C3D] tracking-tight text-base sm:text-lg flex items-center gap-2 font-rounded">
            토모 AI고 (Tomo AI Go)
            <span className="hidden sm:inline bg-slate-100 text-[#001C3D] px-2 py-0.5 rounded-full text-[10px] font-black border border-slate-200 font-sans">
              {isAdminMode ? 'ADMIN MODE' : 'TEACHER APP'}
            </span>
          </span>
        </div>

        {/* Center/Right Area: Prominent Mode switch with interactive visual design */}
        <div className="flex items-center gap-4">
          
          {/* Mode Switcher Buttons */}
          <div className="bg-slate-100 p-1 rounded-2xl flex items-center border border-slate-200/50 shadow-inner">
            {userRole === 'ADMIN' && (
              <button
                id="admin-mode-trigger"
                onClick={() => {
                  setIsAdminMode(true);
                  triggerToast('👑 관리자 디렉터 권한 제어판이 실행되었습니다.');
                }}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
                  isAdminMode
                    ? 'bg-[#001C3D] text-white shadow-md'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${isAdminMode ? 'bg-[#8EF6D6] animate-ping' : 'bg-slate-400'}`}></div>
                관리자 모드
              </button>
            )}
            <button
              id="teacher-mode-trigger"
              onClick={() => {
                if (userRole === 'ADMIN') {
                  setIsAdminMode(false);
                  triggerToast('🏡 햇살반 전소은 교사 친환경 모드가 실행되었습니다.');
                }
              }}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
                !isAdminMode
                  ? 'bg-[#FF6B6B] text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              disabled={userRole !== 'ADMIN'}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${!isAdminMode ? 'bg-[#FFD93D] animate-ping' : 'bg-slate-400'}`}></div>
              교사 모드
            </button>
          </div>

          {/* User profile photo, class name badge, and dynamic Keeper Button */}
          <div className="flex items-center gap-3 border-l border-slate-200 pl-4 h-9">
            <div className="text-right hidden md:block">
              <p className="text-xs font-extrabold text-[#001C3D] leading-none">
                {isAdminMode ? 'Tomo 관리자' : '전소은 교사 (대표교사)'}
              </p>
            </div>



            {/* Prominent Cabinet Drawer control Button: [내 보관함] - ONLY Active in Teacher Mode or shown for premium completeness */}
            {!isAdminMode && (
              <button
                id="drawer-keeper-toggle-btn"
                onClick={() => {
                  setIsSavedDrawerOpen(true);
                  triggerToast('💼 내 보관함 서랍이 열렸습니다. 저장하신 프롬프트가 모여있습니다.');
                }}
                className="ml-2 bg-[#001C3D] text-white hover:bg-[#002B5C] px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <FolderSync className="w-3.5 h-3.5 text-[#FFD93D]" />
                [내 보관함]
                <span className="bg-[#FF6B6B] text-white text-[9px] px-1.5 rounded-full font-black">
                  {savedUserPrompts.length}
                </span>
              </button>
            )}

            {/* Premium Logout Button */}
            <button
              id="tomo-logout-btn"
              onClick={handleLogout}
              className="ml-2 p-2 bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-[#FF6B6B] border border-slate-200 hover:border-rose-100 rounded-xl transition-all shadow-sm hover:shadow flex items-center justify-center cursor-pointer group"
              title="로그아웃"
            >
              <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      </header>

      {/* RENDER BODY BASED ON SELECTED MODE */}
      <div className="flex flex-1 pt-16 h-screen overflow-hidden" id="tomo-main-body-container">
        
        {/* ==============================================================
            A. TEACHER MODE (교사 모드): 좌측 간량 가이드바 + 3단계 Wizard 캠퍼스
            ============================================================== */}
        {!isAdminMode ? (
          <div className="flex-1 flex overflow-hidden h-full" id="teacher-interactive-workspace">
            
            {/* Left Sidebar Menu Navigation */}
            <aside
              className="w-64 bg-[#001C3D] text-slate-300 pointer-events-auto shrink-0 flex flex-col justify-between select-none shadow-lg border-r border-[#0d2a4d] h-full overflow-y-auto"
              id="teacher-global-sidebar"
            >
              <div className="flex flex-col">
                {/* Visual App Logo & Brand inside sidebar */}
                <div className="p-5 border-b border-[#0d2a4d]/60 bg-[#00142B] flex justify-center items-center select-none">
                  <img
                    src={aiGoLogo}
                    alt="Tomo AI Go Logo"
                    className="max-w-[160px] h-auto object-contain py-1"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* Left Sidebar Navigation Options as requested verbatim */}
                <div className="p-4 space-y-4">
                  {/* 글쓰기 마스터 그룹 */}
                  <div>
                    <div className="text-sm text-[#E2EDF8] font-bold tracking-wide px-2 mb-3.5 select-none flex items-center justify-between">
                      <span>📝 글쓰기 팩토리</span>
                      <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-medium px-2 py-0.5 rounded-full">Text Mode</span>
                    </div>
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          handleActiveDomainChange('TEXT');
                          setWizardStep(1);
                          triggerToast('📋 <글쓰기 마스터: 템플릿 큐레이션> 탐색 조정되었습니다.');
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          activeDomain === 'TEXT' && wizardStep === 1
                            ? 'bg-rose-500 text-white shadow-md font-black'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>템플릿 큐레이션</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleActiveDomainChange('TEXT');
                          setWizardStep(2);
                          triggerToast('📝 <글쓰기 마스터: 프롬프트 캔버스> 진입합니다.');
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          activeDomain === 'TEXT' && wizardStep === 2
                            ? 'bg-rose-500 text-white shadow-md font-black'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>프롬프트 캔버스</span>
                      </button>
                    </div>
                  </div>

                  {/* 디자인 마스터 그룹 */}
                  <div>
                    <div className="text-sm text-[#E2EDF8] font-bold tracking-wide px-2 mb-3.5 select-none flex items-center justify-between">
                      <span>🎨 디자인 팩토리</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-medium px-2 py-0.5 rounded-full">Design Mode</span>
                    </div>
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          handleActiveDomainChange('DESIGN');
                          setWizardStep(1);
                          triggerToast('📋 <디자인 마스터: 템플릿 큐레이션> 탐색 조정되었습니다.');
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          activeDomain === 'DESIGN' && wizardStep === 1
                            ? 'bg-rose-500 text-white shadow-md font-black'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>템플릿 큐레이션</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleActiveDomainChange('DESIGN');
                          setWizardStep(2);
                          triggerToast('🎨 <디자인 마스터: 디자인 캔버스> 진입합니다.');
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          activeDomain === 'DESIGN' && wizardStep === 2
                            ? 'bg-rose-500 text-white shadow-md font-black'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Palette className="w-3.5 h-3.5" />
                        <span>디자인 캔버스</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

                {/* Sidebar Footer */}
                <div className="border-t border-[#0d2a4d]/75 bg-[#00142B] p-4 flex flex-col space-y-4">
                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider block mb-1">도움말 및 지원 (Help & Support)</span>
                    <button
                      type="button"
                      onClick={() => triggerToast('📚 [사용 가이드] Tomo AI Go 교무 길라잡이 매뉴얼을 불러옵니다.')}
                      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-[11px] font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all text-left cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-rose-450" />
                      <span>📚 사용 가이드</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerToast('💬 [고객 지원/도움말] 원내 전산 핫라인 기술 전담팀으로 실시간 지원을 요청합니다.')}
                      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-[11px] font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all text-left cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                      <span>💬 고객 지원/도움말</span>
                    </button>
                  </div>
                  <div className="pt-2 text-center text-[10px] text-slate-500 font-bold border-t border-[#0d2a4d]/30">
                    <span>Tomo AI Go v2.4</span>
                  </div>
                </div>
              </aside>

              {/* Main Interactive Canvas Center */}
              <main className="flex-1 p-6 overflow-y-auto h-full" id="teacher-canvas-viewport">
                


                {/* --- STEP 1: TEMPLATE CURATION --- */}
                {wizardStep === 1 && (
                  <div className="space-y-6">
                    {/* Header summary of template curation step */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <h3 className="sys-heading-main text-[#001C3D] flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-[#FF6B6B]" />
                          {activeDomain === 'TEXT' ? '1. 글쓰기 템플릿 큐레이션' : '1. 디자인 템플릿 큐레이션'}
                        </h3>
                        <p className="sys-body font-semibold text-slate-600 mt-1">
                          탬플릿을 선택하세요.
                        </p>
                      </div>
                    </div>

                    {/* Top Search & Filter Area */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                    {/* Full width search bar */}
                    <div className="relative w-full">
                      <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="템플릿 이름이나 키워드 검색..."
                        value={searchQuery}
                        onChange={e => {
                          setSearchQuery(e.target.value);
                        }}
                        className="w-full pl-11 pr-4 py-3 text-xs bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-[#854dff]/20 text-slate-700 font-semibold"
                        id="teacher-search-box"
                      />
                    </div>

                    {/* Pill-shaped segmented control for main categories */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">대분류:</span>
                      <div className="bg-slate-100/85 p-1 rounded-2xl flex flex-wrap items-center border border-slate-200/40">
                        {(['원운영', '반운영', '관찰/평가', '기타', '지원자료'] as const).map(mainCat => (
                          <button
                            key={mainCat}
                            type="button"
                            onClick={() => {
                              setSelectedMainCategory(mainCat);
                              setSelectedSubCategory('전체'); // reset sub category when main changes
                              triggerToast(`대분류 [${mainCat}] 선택되었습니다.`);
                            }}
                            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              selectedMainCategory === mainCat
                                ? mainCat === '반운영'
                                  ? 'bg-[#854dff] text-white shadow-sm font-black'
                                  : mainCat === '기타'
                                    ? 'bg-[#10b981] text-white shadow-sm font-black'
                                    : mainCat === '관찰/평가'
                                      ? 'bg-[#f43f5e] text-white shadow-sm font-black'
                                      : 'bg-[#FF6B6B] text-white shadow-sm font-black'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            {mainCat}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Small outline-style sub-category chips */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-50">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">소분류 태그:</span>
                      
                      {/* Show dynamic sub category chips based on selected main category */}
                      <button
                        type="button"
                        onClick={() => setSelectedSubCategory('전체')}
                        className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                          selectedSubCategory === '전체'
                            ? 'border-[#FF6B6B] bg-[#FFF5F5] text-[#FF6B6B]'
                            : 'border-slate-200 text-slate-500 hover:border-[#FF6B6B]'
                        }`}
                      >
                        #전체
                      </button>
                      {(currentSubCategoriesMap[selectedMainCategory] || []).map(sub => (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => setSelectedSubCategory(sub)}
                          className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                            selectedSubCategory === sub
                              ? 'border-[#FF6B6B] bg-[#FFF5F5] text-[#FF6B6B]'
                              : 'border-slate-200 text-slate-500 hover:border-[#FF6B6B]'
                          }`}
                        >
                          #{sub}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Pinterest-style dynamic grid showing highly compact, premium content cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" id="teacher-masonry-view">
                    {(() => {
                      // 1. Get all active prompts that are not hidden
                      let allPrompts = activePrompts.filter(p => !p.isHidden);
                      
                      // Only display user-created templates in teacher (deployed) mode
                      if (!isAdminMode) {
                        allPrompts = allPrompts.filter(p => p.id.includes('-'));
                      }
                      
                      // 3. Print log of all prompts to the console as requested by developers
                      console.log(allPrompts);

                      const query = searchQuery.trim().toLowerCase();
                      const hasSearch = query.length > 0;

                      // 2. Perform loose filtering
                      let filtered = allPrompts.filter(p => {
                        // Title / Description / Category / Tags search match
                        let matchQ = true;
                        if (hasSearch) {
                          matchQ =
                            p.title.toLowerCase().includes(query) ||
                            p.description.toLowerCase().includes(query) ||
                            (p.category || '').toLowerCase().includes(query) ||
                            (p.promptText || '').toLowerCase().includes(query) ||
                            (p.tags || []).some(t => t.toLowerCase().includes(query));
                        }
                        
                        // Main Category Match (ignored if hasSearch is true)
                        let matchMain = true;
                        if (!hasSearch) {
                          const listForMain = (currentSubCategoriesMap[selectedMainCategory] || []).map(s => s.replace(/^#/, '').trim().toLowerCase());
                          matchMain = isLooseMatch(p.mainCategory || '', selectedMainCategory) || 
                                            (!p.mainCategory && (
                                              isLooseMatch(p.category || '', selectedMainCategory) ||
                                              listForMain.some(subItem => isLooseMatch(p.category || '', subItem))
                                            ));
                        }
                        
                        // Sub Category / Tag Match (ignored if hasSearch is true)
                        let matchSub = true;
                        if (!hasSearch && selectedSubCategory !== '전체') {
                          const cleanSub = selectedSubCategory.replace(/^#/, '').trim().toLowerCase();
                          const catMatches = isLooseMatch(p.category || '', cleanSub);
                          const tagMatches = (p.tags || []).some(tag => isLooseMatch(tag, cleanSub));
                          matchSub = catMatches || tagMatches;
                        }
                        
                        return matchQ && matchMain && matchSub;
                      });

                      // Sort filtered by createdAt descending and id descending
                      filtered.sort((a, b) => {
                        const dateA = a.createdAt || '';
                        const dateB = b.createdAt || '';
                        if (dateA !== dateB) {
                          return dateB.localeCompare(dateA);
                        }
                        return (b.id || '').localeCompare(a.id || '');
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="col-span-full p-16 text-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200 shadow-sm space-y-4 my-4 animate-fadeIn" key="empty-prompts">
                            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto text-slate-300">
                              <HelpCircle className="w-6 h-6 animate-pulse" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm font-black text-slate-800">해당 대분류 및 검색 조건에 부합하는 프롬프트가 아직 등록되지 않았습니다.</p>
                              <p className="text-xs text-slate-500 font-bold leading-relaxed">
                                [관리자 모드]로 전환하여 이 대분류와 하위 카테고리에 맞는 새 프롬프트 템플릿을 등록해 주시거나,<br className="hidden sm:inline" />
                                다른 상단 분류 탭을 선택해 주시기 바랍니다.
                              </p>
                            </div>
                          </div>
                        );
                      }

                      return filtered.map(p => (
                        <div
                          key={p.id}
                          onClick={() => selectTemplateAndGoToCanvas(p)}
                          className="bg-white rounded-2xl border border-slate-150 p-4 shadow-sm hover:shadow-md hover:border-[#FF6B6B]/40 cursor-pointer transition-all duration-200 flex flex-col justify-between relative"
                        >
                          <div>
                            {/* Banner row */}
                            <div className="flex items-center justify-between mb-2">
                              <PromptCategoryPill category={p.category} />
                            </div>

                            {/* Title row */}
                            <h3 className="sys-heading-sub text-[#001C3D] flex items-center gap-1.5 leading-snug">
                              {p.title}
                            </h3>

                            {/* Description row */}
                            <p className="sys-body text-slate-500 mt-1.5 leading-relaxed font-semibold line-clamp-2">
                              {p.description}
                            </p>

                            {/* Content Preview: visible at all times */}
                            {(() => {
                              const rawText = p.canvasTemplate ?? p.promptText;
                              const previewText = normalizeDoubleCurlyBraces(rawText);
                              return (
                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs mt-3 leading-relaxed text-slate-600 whitespace-pre-wrap line-clamp-4 overflow-hidden">
                                  {renderHighlightedText(previewText)}
                                </div>
                              );
                            })()}

                            {/* Tags section */}
                            <PromptHashtags tags={p.tags} />
                          </div>

                          {/* Action Area Optimization (Teacher Mode ONLY): Single, primary, full-width CTA button */}
                          <div className="mt-4 pt-3 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                selectTemplateAndGoToCanvas(p);
                              }}
                              className="w-full bg-[#001C3D] hover:bg-[#FF6B6B] text-white py-2 px-4 rounded-xl sys-button transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                            >
                              <span>[선택하기]</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {/* --- STEP 2: PROMPT CANVAS (7:3 split layout) --- */}
              {wizardStep === 2 && (
                !selectedTemplate ? (
                  <div className="min-h-[350px] flex flex-col items-center justify-center bg-white rounded-2xl p-6 border border-slate-200/80 shadow-md text-center">
                    <div className="w-16 h-16 bg-rose-50 text-[#FF6B6B] rounded-full flex items-center justify-center mb-6">
                      <Sliders className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-black text-[#001C3D] mb-6">
                      선택된 템플릿이 없습니다
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setWizardStep(1);
                        triggerToast('📋 템플릿 큐레이션으로 이동합니다.');
                      }}
                      className="px-6 py-3 bg-[#FF6B6B] hover:bg-[#FF5252] text-white text-sm font-bold rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-2 mx-auto"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>템플릿 큐레이션으로 가기</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                  <div>
                    <h3 className="sys-heading-main text-[#001C3D] flex items-center gap-2">
                      <Sliders className="w-5 h-5 text-[#FF6B6B]" />
                      2. 프롬프트 캔버스
                    </h3>
                    <p className="sys-body font-semibold text-slate-600 mt-1">
                      프롬프트를 수정하세요.
                    </p>
                  </div>

                  {/* Unified layout structure with empty focus area on the right */}
                  <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
                    
                    {/* Center: Mega Canvas - Expanded to col-span-8 to occupy more space */}
                    <div className="lg:col-span-8 bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-md flex flex-col space-y-4">
                      
                      {/* Version Sync Banner */}
                      {versionControlEnabled && selectedTemplate && (templateVersions[selectedTemplate.id] || 1) > selectedTemplateWorkingVersion && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-amber-100 text-amber-600 animate-bounce">
                              <FolderSync className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-xs font-black text-amber-800">⚠️ 원내 표준 서식 기준 최신 업데이트 감지!</p>
                              <p className="text-[10px] text-amber-600 font-bold">
                                관리자가 표준안을 개정 배포하였습니다. (개인 작업 v{selectedTemplateWorkingVersion}.0 → 정규 표준 v{templateVersions[selectedTemplate.id] || 1}.0)
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const latestPrompt = activePrompts.find(p => p.id === selectedTemplate.id);
                              if (latestPrompt) {
                                const textToLoad = latestPrompt.canvasTemplate ?? latestPrompt.promptText;
                                const normalizedText = normalizeDoubleCurlyBraces(textToLoad);
                                setCanvasText(normalizedText);
                                setSelectedTemplateWorkingVersion(templateVersions[selectedTemplate.id] || 1);
                                
                                const vars = parseVariables(textToLoad);
                                setVariableValues(prev => {
                                  const next = { ...prev };
                                  vars.forEach(v => {
                                    if (next[v.name] === undefined) {
                                      next[v.name] = v.defaultValue;
                                    }
                                  });
                                  return next;
                                });
                                triggerToast('🔄 최신 원내 공식 서지 표준으로 싱크 동기화가 반영되었습니다!');
                              }
                            }}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black px-3.5 py-2 rounded-xl transition-all shadow-sm cursor-pointer whitespace-nowrap"
                          >
                            최신 표준 동기화 (Sync to Latest Standard)
                          </button>
                        </div>
                      )}

                      {/* Global Engine Bar (Top Layer) */}
                      <div className="bg-slate-900 text-white rounded-2xl p-3 md:p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm border border-slate-800">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
                          <div className="text-left">
                            <p className="text-[11px] font-black tracking-wide text-slate-200">외부 AI 연동</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              window.open('https://chatgpt.com', '_blank');
                              triggerParticles(['🤖', '✨'], e.clientX, e.clientY);
                              triggerToast('🤖 ChatGPT가 새 창에서 열렸습니다.');
                            }}
                            className="h-8 px-3.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 bg-slate-800 hover:bg-slate-700 text-slate-150 border border-slate-700/80 hover:border-slate-500"
                            title="ChatGPT 웹사이트를 새 탭에서 열기"
                          >
                            <span>🤖 ChatGPT 열기</span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              window.open('https://gemini.google.com/app', '_blank');
                              triggerParticles(['✨', '🔮'], e.clientX, e.clientY);
                              triggerToast('✨ Google Gemini가 새 창에서 열렸습니다.');
                            }}
                            className="h-8 px-3.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 bg-slate-800 hover:bg-slate-700 text-slate-150 border border-slate-700/80 hover:border-slate-500"
                            title="Gemini 웹사이트를 새 탭에서 열기"
                          >
                            <span>✨ Gemini 열기</span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </button>

                        </div>
                      </div>

                      {/* Visual Separation Line/Spacing */}
                      <div className="pt-2 pb-1 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-extrabold tracking-wider uppercase">캔버스 가이드</span>
                        <div className="h-px bg-slate-100 flex-1 ml-4"></div>
                      </div>

                      {/* Canvas Toolbar (Lower Layer) */}
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between bg-slate-50 border border-slate-200/80 p-3 rounded-2xl gap-3 shadow-2xs mb-4">
                        {/* Title and Version info */}
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckSquare className="w-4 h-4 text-[#FF6B6B]" />
                          <span className="text-xs font-black text-[#001C3D] truncate max-w-[180px] sm:max-w-xs" title={selectedTemplate?.title}>
                            {selectedTemplate?.title}
                          </span>
                        </div>

                        {/* Middle/Right: Toolbar tools */}
                        <div className="flex items-center gap-3 justify-between lg:justify-end flex-wrap sm:flex-nowrap">
                          {/* Inner Tool Dock */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* ↺ 되돌리기 */}
                            <button
                              type="button"
                              onClick={() => {
                                setCanvasText(initialPromptText);
                                setVariableValues(variableDefaults);
                                setActiveTagIndex(null);
                                setLastCopiedTagValue(null);
                                setIsPromptCopied(false);
                                triggerToast('↺ 프롬프트 텍스트 및 모든 스마트 태그가 최초 원본 상태로 복구되었습니다.');
                              }}
                              className="h-8 px-2.5 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 rounded-xl text-[11px] font-black border border-slate-250 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
                              <span>되돌리기</span>
                            </button>

                            {/* 📋 복사하기 */}
                            <button
                              type="button"
                              onClick={(e) => {
                                navigator.clipboard.writeText(assembledMegaPrompt);
                                setLastCopiedTagValue(null);
                                setIsPromptCopied(true);
                                triggerParticles(['🚀', '✨', '⚡', '💖'], e.clientX, e.clientY);
                                setAnalyticsCopyVolume(prev => prev + 1);
                                triggerToast('📋 메가 프롬프트가 클립보드로 전체 복사 완료되었습니다!');
                              }}
                              className="h-8 px-2.5 bg-slate-800 hover:bg-slate-900 border border-slate-700 text-white rounded-xl text-[11px] font-extrabold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5 text-slate-300" />
                              <span>복사하기</span>
                            </button>

                            {/* 📁 내 보관함 */}
                            <button
                              type="button"
                              onClick={() => {
                                setCanvasSaveTitle(selectedTemplate ? `${selectedTemplate.title} (수정본)` : '새로운 프롬프트');
                                setCanvasSaveDestination('personal');
                                setCanvasSaveSelectedFolder('미분류');
                                setIsCanvasSaveCreatingNewFolder(false);
                                setCanvasSaveNewFolderName('');
                                setIsCanvasSaveModalOpen(true);
                              }}
                              className={`h-8 px-3 text-white rounded-xl text-[11px] font-black shadow-2xs hover:scale-101 active:scale-99 transition-all flex items-center gap-1.5 cursor-pointer ${
                                canvasSavedFeedback ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-[#FF6B6B] hover:bg-[#fa5353]'
                              }`}
                            >
                              {canvasSavedFeedback ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>✓ 보관 완료</span>
                                </>
                              ) : (
                                <>
                                  <FolderSync className="w-3.5 h-3.5" />
                                  <span>내 보관함</span>
                                </>
                              )}
                            </button>
                          </div>

                          <span className="text-slate-300 font-light hidden sm:inline">|</span>

                          {/* Toggle Mode [태그 모드] [코드 모드] */}
                          <div className="flex bg-slate-200/80 p-0.5 rounded-xl border border-slate-200/50 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setTeacherEditMode('tags');
                                triggerToast('💬 스마트 태그 비주얼 인터랙티브 뷰를 활성화했습니다.');
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                                teacherEditMode === 'tags'
                                  ? 'bg-white text-[#FF6B6B] shadow-xs font-black'
                                  : 'text-slate-500 hover:text-slate-850'
                              }`}
                            >
                              태그 모드
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setTeacherEditMode('raw');
                                triggerToast('📝 생 텍스트 원문 자유 편집 모드를 활성화했습니다.');
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                                teacherEditMode === 'raw'
                                  ? 'bg-white text-slate-800 shadow-xs font-black'
                                  : 'text-slate-500 hover:text-slate-850'
                              }`}
                            >
                              코드 모드
                            </button>
                          </div>
                        </div>
                      </div>

                                           {/* Display Mode: Interactive Tags Fill vs Raw Content Textarea */}
                      {teacherEditMode === 'tags' ? (
                        <div className="w-full min-h-80 p-5 rounded-2xl border border-slate-200 bg-[#FAF9F6] text-slate-800 leading-relaxed overflow-y-auto space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
                            <span className="text-[10px] font-black text-[#FF6B6B] uppercase tracking-wider flex items-center gap-1">
                              <span>■</span> 스마트 가이드 모드 (아래 개별 태그 단추를 클릭해 채워보세요)
                            </span>
                            <span className="text-[9px] text-slate-400 font-bold">Click variables to edit</span>
                          </div>


                          
                          <div className="font-semibold font-sans text-xs tracking-wide leading-loose">
                            {(() => {
                              const parts = splitBySmartTags(canvasText);
                              return parts.map((part, idx) => {
                                if (part.startsWith('[') && part.endsWith(']')) {
                                  // Slot: [텍스트]
                                  const slotContent = cleanSlotLabel(part.slice(1, -1));
                                  return (
                                    <span 
                                      key={idx} 
                                      className="inline-flex items-start text-left px-4 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-700 border border-amber-300/40 mx-1 align-middle whitespace-normal break-words leading-relaxed"
                                    >
                                      {slotContent}
                                    </span>
                                  );
                                } else if (part.startsWith('{') && part.endsWith('}')) {
                                  // Tag: {텍스트}
                                  const tagContent = cleanTagLabel(part.slice(1, -1));
                                  const isEditing = activeTagIndex === idx;
                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => {
                                        setActiveTagIndex(idx);
                                        setActiveTagValue(tagContent);
                                        triggerToast(`✏️ 스마트 태그 [${tagContent}] 기입 상자를 로드했습니다.`);
                                      }}
                                      className={`inline-flex items-start text-left gap-1.5 mx-1 px-4 py-1.5 bg-blue-50 hover:bg-blue-100 border rounded-lg text-xs font-black transition-all transform hover:scale-105 active:scale-95 duration-100 shadow-xs cursor-pointer align-middle whitespace-normal break-words leading-relaxed ${
                                        isEditing 
                                          ? 'border-blue-500 bg-blue-100 text-blue-800 ring-2 ring-blue-500/30'
                                          : 'border-blue-200 text-blue-750'
                                      }`}
                                    >
                                      <span className="text-[9px] text-blue-400 mt-0.5 shrink-0">🏷️</span>
                                      <span className="underline decoration-dotted decoration-blue-500/40 text-left block flex-1">{tagContent}</span>
                                    </button>
                                  );
                                } else {
                                  // Plain text
                                  return (
                                    <span key={idx} className="whitespace-pre-wrap text-slate-700 font-sans text-xs font-semibold">
                                      {part}
                                    </span>
                                  );
                                }
                              });
                            })()}
                          </div>

                          {/* Interactive Tag Input Modal Popover near editor block */}
                          <AnimatePresence>
                            {activeTagIndex !== null && (
                              <motion.div
                                id="tomo-tag-edit-panel"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                onMouseEnter={() => setIsHoveringPanel(true)}
                                onMouseLeave={() => setIsHoveringPanel(false)}
                                className="bg-[#FFFBF8] border border-blue-200 rounded-2xl p-4 mt-6 shadow-md space-y-3"
                              >
                                <div className="flex items-center justify-between border-b border-blue-100/60 pb-2">
                                  <span className="text-xs font-black text-blue-800 flex items-center gap-1.5">
                                    <span>✏️</span> 스마트 태그 값 수정: <strong className="text-blue-600 bg-white px-2 py-0.5 rounded border border-rose-200">태그 수정 중</strong>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setActiveTagIndex(null)}
                                    className="p-1 rounded-md text-slate-400 hover:text-slate-655 cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <div className="flex flex-col gap-3">
                                  <div className="flex flex-col md:flex-row gap-3">
                                    <textarea
                                      value={activeTagValue}
                                      onChange={e => setActiveTagValue(e.target.value)}
                                      placeholder="여기에 값을 기입하세요..."
                                      onBlur={() => {
                                        if (activeTagIndex !== null) {
                                          handleTagUpdateWithoutClosing(activeTagIndex, activeTagValue);
                                        }
                                      }}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                          e.preventDefault();
                                          handleTagUpdate(activeTagIndex, activeTagValue);
                                        } else if (e.key === 'Escape') {
                                          setActiveTagIndex(null);
                                        }
                                      }}
                                      className="flex-1 min-h-[96px] text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 resize-y whitespace-pre-wrap break-words leading-relaxed"
                                      autoFocus
                                    />
                                    <div className="flex md:flex-col gap-2 justify-end shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => handleTagUpdate(activeTagIndex, activeTagValue)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 h-10"
                                      >
                                        적용
                                      </button>
                                      {activeTagIndex !== null && (
                                        <button
                                          type="button"
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleCopyActiveTagText(e);
                                          }}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleCopyActiveTagText(e);
                                          }}
                                          className="border border-slate-250 hover:border-slate-350 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 active:scale-95 shadow-sm h-10"
                                        >
                                          <span>{isTagCopied ? '✓' : '📄'}</span> {isTagCopied ? '복사 완료' : '프롬프트 복사'}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                    <span>💡</span>
                                    <span>줄바꿈은 <kbd className="bg-white px-1 py-0.5 rounded border border-slate-200 text-slate-600 font-mono text-[9px]">Enter</kbd>, 수정 완료는 우측 <strong>[적용]</strong> 버튼이나 <kbd className="bg-white px-1 py-0.5 rounded border border-slate-200 text-slate-600 font-mono text-[9px]">Ctrl + Enter</kbd> 키를 누르세요. 우측 하단 모서리를 끌어 상자 높이를 조절할 수 있습니다.</span>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ) : (
                        <textarea
                          value={canvasText}
                          onChange={e => setCanvasText(e.target.value)}
                          className="w-full h-80 p-5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#FF6B6B]/20 text-slate-700 sys-body font-mono leading-relaxed resize-none bg-[#FAF9F6]/80 focus:bg-white transition-all shadow-inner"
                          placeholder="이곳에 유아 지도 행동, 날씨, 가정 소통 에포크 등의 명령문 본문을 자유자재로 기입하세요..."
                        />
                      )}


                      {/* Info bar explaining actions */}
                      <div className="text-[11px] text-slate-400 flex items-start gap-1.5 pl-1">
                        <Info className="w-3.5 h-3.5 text-rose-450 mt-0.5 shrink-0" />
                        <span className="leading-normal">
                          <strong className="text-slate-600 block mb-0.5">📢 작성 전 필독</strong>
                          {activeDomain === 'TEXT' ? (
                            <>본문 속 각 괄호({'{ }'}) 안의 예시 문구를 지우고 우리 원(반) 상황에 맞게 직접 수정하세요. 맞춤법과 띄어쓰기가 정확한지 꼼꼼히 확인해 주시기 바랍니다.</>
                          ) : (
                            <>문서를 더 예쁘게 포장해 줄 '디자인 레시피'입니다! 🪄 글(내용)과 레시피(디자인)를 함께 복사해서 AI 툴에 붙여넣어 보세요. 마법처럼 멋진 문서가 만들어집니다!</>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Right: Empty space / focus area (remaining 2 columns out of 10) */}
                    <div className="lg:col-span-2 hidden lg:block" />
                  </div>


                </div>
                )
              )}

              {/* --- STEP 3: MEGA PROMPT GENERATION --- */}
              {wizardStep === 3 && (
                <div className="space-y-6">
                  <div className="text-center max-w-2xl mx-auto space-y-2">
                    <span className="text-xs bg-[#FFD93D]/20 text-[#B28900] px-3 py-1 rounded-md font-black uppercase tracking-wider inline-block">
                      ASSEMBLY PERFECT COMPLETE
                    </span>
                    <h3 className="sys-heading-main text-[#001C3D]">
                      ✅ 3. 메가 프롬프트
                    </h3>
                    <p className="sys-body text-slate-500">
                      완성된 프롬프트를 최종 검토하고 외부 AI에 붙여넣어 결과물을 확인하세요.
                    </p>
                  </div>

                  {/* Dark-themed 'Code Snippet' block in center for professional tech feel */}
                  <div className="max-w-3xl mx-auto bg-[#001C3D] rounded-3xl border border-slate-700 shadow-2xl overflow-hidden relative pb-16">
                    {/* Dark Code Headbar */}
                    <div className="bg-[#00142B] px-5 py-3.5 flex items-center justify-between border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
                          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>
                          <span className="w-2.5 h-2.5 rounded-full bg-green-400"></span>
                        </div>
                        <span className="text-slate-400 text-xs font-mono font-bold ml-2">Compiled_Prompt_Bundle.ts</span>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-mono">UTF-8 ENCODED COMPRESSED</span>
                    </div>

                    {/* The assembled text preview */}
                    <div className="p-6">
                      <pre className="sys-body font-mono text-slate-200 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto pr-2 select-all">
                        {assembledMegaPrompt}
                      </pre>
                    </div>

                    {/* Highly visible actions inside code block bottom-right */}
                    <div className="absolute right-4 bottom-4 flex items-center gap-2.5">
                      <button
                        onClick={(e) => {
                          navigator.clipboard.writeText(assembledMegaPrompt);
                          triggerParticles(['🚀', '🔮', '✨', '🔥', '🌸'], e.clientX, e.clientY);
                          setAnalyticsCopyVolume(prev => prev + 1);
                          triggerToast('📋 메가 프롬프트가 클립보드에 전체 복사되었습니다!');
                        }}
                        className="bg-[#FF6B6B] hover:bg-[#fa5353] text-xs font-black text-white px-4 py-2.5 rounded-xl border border-[#FF6B6B]/20 transition-all duration-200 flex items-center gap-1.5 cursor-pointer shadow-md hover:scale-102 active:scale-98"
                      >
                        [📋 프롬프트 전체 복사]
                      </button>

                      <button
                        onClick={() => {
                          setIsSaveModalOpen(true);
                          setSaveDocTitle(selectedTemplate ? `${selectedTemplate.title} (메가 프롬프트)` : '새로운 메가 프롬프트');
                          setSaveDestination('personal');
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500 text-xs font-black text-white px-4 py-2.5 rounded-xl border border-emerald-500/20 transition-all duration-200 flex items-center gap-1.5 cursor-pointer shadow-md hover:scale-102 active:scale-98"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>[💾 저장하기]</span>
                      </button>
                    </div>
                  </div>

                  {/* New AI Launchpad Section */}
                  <div className="max-w-3xl mx-auto space-y-4 pt-2">
                    <p className="text-xs font-semibold text-slate-500 text-center">
                      프롬프트를 복사한 후, 원하는 AI 플랫폼을 선택해 붙여넣으세요.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Button 1: ChatGPT (Grey/Black border) */}
                      <a
                        href="https://chatgpt.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          window.open('https://chatgpt.com', '_blank');
                          triggerParticles(['🤖', '✨'], e.clientX, e.clientY);
                          triggerToast('🤖 ChatGPT가 새 창에서 열렸습니다.');
                        }}
                        className="flex items-center justify-center gap-2.5 px-5 py-4 bg-white hover:bg-slate-50/50 border border-slate-300 hover:border-black rounded-2xl text-xs font-extrabold text-slate-800 transition-all shadow-sm hover:shadow-md cursor-pointer text-center group"
                      >
                        <MessageSquare className="w-4 h-4 text-zinc-600 group-hover:text-black transition-colors" />
                        <span>ChatGPT</span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                      </a>

                      {/* Button 2: Gemini (Blue/Purple border) */}
                      <a
                        href="https://gemini.google.com/app"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          window.open('https://gemini.google.com/app', '_blank');
                          triggerParticles(['✨', '🔮'], e.clientX, e.clientY);
                          triggerToast('✨ Google Gemini가 새 창에서 열렸습니다.');
                        }}
                        className="flex items-center justify-center gap-2.5 px-5 py-4 bg-white hover:bg-[#854dff]/5 border border-purple-200 hover:border-[#854dff] rounded-2xl text-xs font-extrabold text-[#854dff] transition-all shadow-sm hover:shadow-md cursor-pointer text-center group"
                      >
                        <Sparkles className="w-4 h-4 text-[#854dff] animate-pulse" />
                        <span>Gemini</span>
                        <ExternalLink className="w-3.5 h-3.5 text-purple-300 group-hover:text-purple-500" />
                      </a>

                      {/* Button 3: Canva (Gradient or Blue border) */}
                      <a
                        href="https://www.canva.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2.5 px-5 py-4 bg-white hover:bg-sky-50/50 border border-sky-300 hover:border-sky-600 rounded-2xl text-xs font-extrabold text-sky-800 transition-all shadow-sm hover:shadow-md cursor-pointer text-center group"
                      >
                        <Layers className="w-4 h-4 text-sky-500 group-hover:text-sky-600 transition-colors" />
                        <span>Canva</span>
                        <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                      </a>
                    </div>
                  </div>

                  {/* Micro guide help links card */}
                  <div className="max-w-md bg-white border border-rose-100/40 p-4 rounded-2xl shadow-sm text-xs text-slate-600 mx-auto space-y-2">
                    <p className="font-bold text-[#001C3D] flex items-center gap-1">
                      <BookOpen className="w-4 h-4 text-[#FF6B6B]" />
                      어떻게 사용하나요?
                    </p>
                    <ol className="list-decimal list-inside pl-1 space-y-1 text-[11px] text-slate-500">
                      <li>상단 붉은색 버튼을 누르면 원고가 안전하게 복사됩니다.</li>
                      <li>AI Studio, ChatGPT 등의 입력창에서 붙여넣기(Ctrl+V) 하세요.</li>
                      <li>생성된 부모 맞춤형 피드백을 토모노트에 가볍게 등록하면 퇴근이 앞당겨집니다!</li>
                    </ol>
                  </div>

                </div>
              )}

            </main>
          </div>
        ) : (
          
          // ==============================================================
          // B. ADMIN MODE (관리자 모드): 좌측 네비바 + CMS / Analytics 전환 패널
          // ==============================================================
          <div className="flex-1 flex bg-[#F5F7FA] overflow-hidden h-full" id="admin-main-viewport">
            
            {/* Left Sidebar Menu Navigation */}
            <aside
              className="w-60 bg-[#001C3D] text-slate-300 pointer-events-auto shrink-0 flex flex-col justify-between select-none shadow-lg border-r border-[#0d2a4d] h-full overflow-y-auto"
              id="admin-navy-sidebar"
            >
              <div className="flex flex-col">
                {/* Visual App Logo & Brand inside sidebar (Secret developer access) */}
                <div
                  className="p-4 border-b border-[#0d2a4d]/60 bg-[#00142B] flex justify-center items-center select-none cursor-pointer hover:opacity-90 active:scale-95 transition-all"
                  onClick={() => {
                    setLogoClicks(prev => {
                      const count = prev + 1;
                      if (count >= 5) {
                        setShowSyncModal(true);
                        triggerToast('🔓 개발자용 숨겨진 백업 및 동기화 패널이 활성화되었습니다.');
                        return 0;
                      }
                      return count;
                    });
                  }}
                >
                  <img
                    src={aiGoLogo}
                    alt="Tomo AI Go Logo"
                    className="max-w-[150px] h-auto object-contain py-1"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* Sidebar Navigation Options */}
                <div className="p-3 space-y-1">
                  
                  {/* Menu Option 1: 프롬프트 팩토리 */}
                  <button
                    id="admin-nav-cms-text"
                    type="button"
                    onClick={() => {
                      setAdminTab('cms');
                      handleActiveDomainChange('TEXT');
                      triggerToast('⚙️ CMS 원시 프롬프트 관리공장(텍스트)을 호출하였습니다.');
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      adminTab === 'cms' && activeDomain === 'TEXT'
                        ? 'bg-rose-500 text-white shadow-md font-black'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <FolderSync className="w-3.5 h-3.5" />
                    <span>프롬프트 팩토리</span>
                  </button>

                  {/* Menu Option 2: 디자인 팩토리 */}
                  <button
                    id="admin-nav-cms-design"
                    type="button"
                    onClick={() => {
                      setAdminTab('cms');
                      handleActiveDomainChange('DESIGN');
                      triggerToast('⚙️ CMS 원시 디자인 관리공장(디자인)을 호출하였습니다.');
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      adminTab === 'cms' && activeDomain === 'DESIGN'
                        ? 'bg-[#10b981] text-white shadow-md font-black'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Palette className="w-3.5 h-3.5" />
                    <span>디자인 팩토리</span>
                  </button>

                  {/* Menu Option 3: 데이터 분석 */}
                  <button
                    id="admin-nav-analytics"
                    type="button"
                    onClick={() => {
                      setAdminTab('analytics');
                      triggerToast('📊 정량적 연구 분석을 위한 계량 대시보드를 구축했습니다.');
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      adminTab === 'analytics'
                        ? 'bg-rose-500 text-white shadow-md font-black'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                    <span>데이터 분석</span>
                  </button>

                  {/* Menu Option 4: 배포 사이트 동기화 (Hidden as requested) */}
                  {/*
                  <button
                    id="admin-nav-sync"
                    type="button"
                    onClick={() => {
                      setAdminTab('sync');
                      triggerToast('☁️ 개발기와 배포기를 완전히 일치시키는 동기화 패널을 호출했습니다.');
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      adminTab === 'sync'
                        ? 'bg-[#1e40af] text-white shadow-md font-black'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span>배포 사이트 동기화</span>
                  </button>
                  */}

                </div>


              </div>

              {/* Bottom Developer Credits */}
              <div className="p-4 mx-3 mb-4 rounded-xl bg-[#00142B] border border-[#0d2a4d]/80 text-[10px] space-y-1 text-slate-400 font-mono">
                <p className="font-bold text-slate-300">SYSTEM ATTRIBUTES</p>
                <p>Uptime: 100.0% Stable</p>
                <p>Database: Memory Ingest</p>
                <p>SSO Token Hash: ACT-9844x</p>
              </div>
            </aside>

            {/* Main Admin Dashboard Controller Canvas */}
            <main className="flex-1 p-6 overflow-y-auto h-full" id="admin-canvas-content">
              
              {/* MENU 1: PROMPT FACTORY CMS VIEW */}
              {adminTab === 'cms' && (
                <div className="space-y-6">
                  
                  {/* Top Header Row in Admin CMS View */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-4">
                    <div>
                      <h2 className="sys-heading-main text-[#001C3D]">
                        {activeDomain === 'TEXT' ? '프롬프트 팩토리(CMS Control Center)' : '디자인 팩토리(CMS Control Center)'}
                      </h2>
                    </div>

                    {/* Stats summary banner */}
                    <div className="bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 text-xs font-bold text-slate-600">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                        활성 {activePrompts.filter(p => !p.isHidden).length}개
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <EyeOff className="w-3.5 h-3.5" />
                        숨김 {activePrompts.filter(p => p.isHidden).length}개
                      </span>
                    </div>
                  </div>

                  {/* Search and Tag filter block inside Admin View (Visually Mirrored to Teacher view) */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                    {/* Search Field & Show Hidden toggle in one row */}
                    <div className="flex flex-col lg:flex-row gap-3 items-center">
                      <div className="relative flex-1 w-full">
                        <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="프롬프트 제목, 설명 및 명령 구조 정밀 키워드 검색..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 text-xs bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-[#854dff]/20 text-slate-700 font-semibold"
                        />
                      </div>
                      
                      {/* 정렬 드롭다운 */}
                      <div className="relative shrink-0 w-full lg:w-auto">
                        <select
                          value={adminSortOption}
                          onChange={(e) => {
                            setAdminSortOption(e.target.value as any);
                            const label = e.target.value === 'newest' ? '최신 등록순' : e.target.value === 'oldest' ? '오래된 등록순' : '최근 수정순';
                            triggerToast(`📅 템플릿 정렬 기준이 [${label}]으로 적용되었습니다.`);
                          }}
                          className="appearance-none pl-4 pr-10 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-100 hover:border-slate-200 rounded-2xl text-xs font-bold text-slate-700 shadow-xs cursor-pointer focus:outline-none transition-colors w-full lg:w-44"
                        >
                          <option value="newest">📅 최신 등록순</option>
                          <option value="oldest">📅 오래된 등록순</option>
                          <option value="recentlyUpdated">🔄 최근 수정순</option>
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>

                      {/* Show Hidden items switch inside Admin Tool */}
                      <label className="inline-flex items-center cursor-pointer select-none bg-slate-50 hover:bg-slate-100 px-4 py-2.5 rounded-2xl border border-slate-100 shrink-0 w-full lg:w-auto justify-center lg:justify-start">
                        <input
                          type="checkbox"
                          checked={showHidden}
                          onChange={() => setShowHidden(!showHidden)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-[#001C3D] after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:after:translate-x-4 relative"></div>
                        <span className="ml-2 text-xs font-bold text-slate-600">숨김 항목 포함 시뮬레이션</span>
                      </label>
                    </div>

                    {/* Pill-shaped segmented control for main categories (Identical to teacher view) */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">대분류:</span>
                      <div className="bg-slate-100/85 p-1 rounded-2xl flex flex-wrap items-center border border-slate-200/40">
                        {(['원운영', '반운영', '관찰/평가', '기타', '지원자료'] as const).map(mainCat => (
                          <button
                            key={mainCat}
                            type="button"
                            onClick={() => {
                              setSelectedMainCategory(mainCat);
                              setSelectedSubCategory('전체'); // reset sub category when main changes
                              triggerToast(`대분류 [${mainCat}] 선택되었습니다.`);
                            }}
                            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              selectedMainCategory === mainCat
                                ? mainCat === '반운영'
                                  ? 'bg-[#854dff] text-white shadow-sm font-black'
                                  : mainCat === '기타'
                                    ? 'bg-[#10b981] text-white shadow-sm font-black'
                                    : mainCat === '관찰/평가'
                                      ? 'bg-[#f43f5e] text-white shadow-sm font-black'
                                      : 'bg-[#FF6B6B] text-white shadow-sm font-black'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            {mainCat}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Small outline-style sub-category chips (Identical to teacher view) */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-50">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">소분류 태그:</span>
                      
                      {/* Show dynamic sub category chips based on selected main category */}
                      <button
                        type="button"
                        onClick={() => setSelectedSubCategory('전체')}
                        className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                          selectedSubCategory === '전체'
                            ? 'border-[#FF6B6B] bg-[#FFF5F5] text-[#FF6B6B]'
                            : 'border-slate-200 text-slate-500 hover:border-[#FF6B6B]'
                        }`}
                      >
                        #전체
                      </button>
                      {(currentSubCategoriesMap[selectedMainCategory] || []).map(sub => (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => setSelectedSubCategory(sub)}
                          className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                            selectedSubCategory === sub
                              ? 'border-[#FF6B6B] bg-[#FFF5F5] text-[#FF6B6B]'
                              : 'border-slate-200 text-slate-500 hover:border-[#FF6B6B]'
                          }`}
                        >
                          #{sub}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Prompt Template Card Grid (Mirrors Teacher Grid structure) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" id="admin-prompt-masonry-grid">
                    {filteredAdminPrompts.map(p => (
                      <div
                        key={p.id}
                        className={`bg-white rounded-2xl border transition-all flex flex-col justify-between p-4 relative shadow-sm hover:shadow-md ${
                          p.isHidden ? 'border-dashed border-red-300 opacity-60' : 'border-slate-150'
                        }`}
                        id={`admin-prompt-wrapper-card-${p.id}`}
                      >
                        <div>
                          {/* Banner row */}
                          <div className="flex items-center justify-between mb-2">
                            <PromptCategoryPill category={p.category} />
                          </div>

                          <h3 className="sys-heading-sub text-[#001C3D] flex items-center gap-1.5 leading-snug">
                            {p.title}
                            {p.isHidden && (
                              <span className="bg-red-50 text-red-650 sys-tag px-2 py-0.5 rounded-full border border-red-200 uppercase tracking-wider">
                                🔒 숨김 (Hidden)
                              </span>
                            )}
                          </h3>
                          <p className="sys-body text-slate-500 mt-1.5 leading-relaxed font-semibold">
                            {p.description}
                          </p>

                          {/* 최초 등록일 & 최근 수정일 (관리자 모드 전용 이력 추적) */}
                          <div className="mt-2.5 px-3 py-1.5 bg-slate-50 border border-slate-100/60 rounded-xl flex items-center justify-between text-[10px] font-bold text-slate-550 font-mono select-none">
                            <span>📅 최초 등록: {p.createdAt ? p.createdAt.replace(/-/g, '.') : '2026.06.18'}</span>
                            <span className="text-slate-300">|</span>
                            <span>🔄 최근 수정: {p.updatedAt ? p.updatedAt.replace(/-/g, '.') : (p.createdAt ? p.createdAt.replace(/-/g, '.') : '2026.06.18')}</span>
                          </div>

                          {/* Code Preview snippet inside CMS */}
                          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 sys-caption font-mono mt-3 max-h-24 overflow-y-auto leading-relaxed text-slate-600 whitespace-pre-wrap select-all">
                            {renderHighlightedText(p.promptText)}
                          </div>

                          {/* Active and custom tag list below */}
                          <PromptHashtags tags={p.tags} />
                        </div>

                        {/* STATS BREAKDOWN INLINE EXPANDED */}
                        {selectedPromptStatsId === p.id && (
                          <div className="mt-4 p-3 bg-slate-900 text-slate-200 text-xs rounded-xl space-y-2 border border-slate-800">
                            <p className="font-extrabold text-[#FFD93D] flex items-center gap-1">
                              <TrendingUp className="w-3.5 h-3.5" />
                              사용 통계 진단서
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-center text-[11px]">
                              <div className="bg-white/5 p-2 rounded-lg">
                                <p className="text-slate-400 text-[9px]">단독 실행</p>
                                <p className="font-bold text-white text-xs">{p.runs}회 호출</p>
                              </div>
                              <div className="bg-white/5 p-2 rounded-lg">
                                <p className="text-slate-400 text-[9px]">완전성 지수</p>
                                <p className="font-bold text-[#8EF6D6] text-xs">{p.satisfaction}%</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 3-button 'Action Toolbar' replacing selection panel */}
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                          
                          {/* [✏️ 수정] */}
                          <button
                            type="button"
                            onClick={() => openNewPromptModal(p)}
                            className="bg-[#001C3D] hover:bg-slate-800 text-white py-1.5 px-3 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer transition-all active:scale-98 shadow-sm"
                            id={`btn-edit-prompt-verbatim-${p.id}`}
                          >
                            <Edit2 className="w-3 h-3 text-amber-300" />
                            <span>[✏️ 수정]</span>
                          </button>

                          {/* [👁️ 숨김/공개] */}
                          <button
                            type="button"
                            onClick={() => handleToggleHide(p.id)}
                            className={`py-1.5 px-3 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer transition-all active:scale-98 shadow-sm border ${
                              p.isHidden
                                ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                            }`}
                            id={`btn-hide-prompt-verbatim-${p.id}`}
                          >
                            {p.isHidden ? <Eye className="w-3 h-3 text-amber-600" /> : <EyeOff className="w-3 h-3 text-slate-500" />}
                            <span>[👁️ 숨김/공개]</span>
                          </button>

                          {/* [🗑️ 삭제] */}
                          <button
                            type="button"
                            onClick={() => handleAdminDelete(p.id)}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-600 p-2 rounded-xl border border-rose-200 hover:border-rose-300 hover:scale-105 active:scale-95 transition-all cursor-pointer font-bold ml-auto flex items-center justify-center h-8 w-8"
                            title="영구 삭제"
                            id={`btn-delete-prompt-verbatim-${p.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 6. Floating Action Button (FAB) at bottom-right corner verbatim labeled [새 프롬프트 추가] */}
                  <div className="fixed bottom-6 right-6 z-40">
                    <button
                      onClick={() => openNewPromptModal(null)}
                      className="px-6 py-4.5 bg-[#FF6B6B] hover:bg-[#fa5353] text-white rounded-full font-black text-sm transition-all shadow-xl hover:shadow-2xl flex items-center gap-2 hover:scale-105 active:scale-95 transform cursor-pointer border border-[#FF6B6B]/20"
                      id="admin-cms-fab-btn"
                    >
                      <Plus className="w-5 h-5 text-white animate-pulse" />
                      <span>[새 프롬프트 추가]</span>
                    </button>
                  </div>
                </div>
              )}

              {/* MENU 2: DATA DASHBOARD (ANALYTICS VIEW) */}
              {adminTab === 'analytics' && (
                <div className="space-y-6">
                  
                   {/* Top Header Row with highly visible export button labeled [CSV 원시 데이터 추출] and Global Date Filter */}
                  <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b border-slate-200 pb-4">
                    <div>
                      <h2 className="sys-heading-main text-[#001C3D]">
                        데이터 분석 (Quantitative Analytics Console)
                      </h2>
                    </div>

                    {/* Global Date Filter and Export control row */}
                    <div className="flex flex-wrap items-center gap-3 bg-slate-50/80 p-2.5 rounded-2xl border border-slate-200 w-full xl:w-auto">
                      
                      {/* Global Date Filter Section */}
                      <div className="flex flex-wrap items-center gap-1.5 px-1">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider mr-1">Global Date Filter:</span>
                        
                        {/* Year select */}
                        <div className="relative">
                          <select
                            value={globalYear}
                            onChange={(e) => {
                              setGlobalYear(e.target.value);
                              triggerToast(`📅 조회 연도가 ${e.target.value}년으로 변경되어 실시간 데이터가 업데이트되었습니다.`);
                            }}
                            className="appearance-none pl-3 pr-8 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-bold text-slate-700 shadow-sm cursor-pointer focus:outline-none transition-colors"
                          >
                            <option value="2026">2026 YYYY</option>
                            <option value="2025">2025 YYYY</option>
                            <option value="2024">2024 YYYY</option>
                            <option value="2023">2023 YYYY</option>
                          </select>
                          <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
                        </div>

                        {/* Month select */}
                        <div className="relative">
                          <select
                            value={globalMonth}
                            onChange={(e) => {
                              setGlobalMonth(e.target.value);
                              triggerToast(`📅 조회 월이 ${e.target.value}월로 변경되어 실시간 데이터가 업데이트되었습니다.`);
                            }}
                            className="appearance-none pl-3 pr-8 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-bold text-slate-700 shadow-sm cursor-pointer focus:outline-none transition-colors"
                          >
                            {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(m => (
                              <option key={m} value={m}>{m} MM</option>
                            ))}
                          </select>
                          <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
                        </div>

                        {/* Day select */}
                        <div className="relative">
                          <select
                            value={globalDay}
                            onChange={(e) => {
                              setGlobalDay(e.target.value);
                              triggerToast(`📅 조회 일자가 ${e.target.value}일로 변경되어 실시간 데이터가 업데이트되었습니다.`);
                            }}
                            className="appearance-none pl-3 pr-8 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-bold text-slate-700 shadow-sm cursor-pointer focus:outline-none transition-colors"
                          >
                            {Array.from({ length: 31 }, (_, i) => {
                              const d = String(i + 1).padStart(2, '0');
                              return <option key={d} value={d}>{d} DD</option>;
                            })}
                          </select>
                          <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
                        </div>
                      </div>

                      {/* Verbatim Export Button: [CSV 원시 데이터 추출] */}
                      <button
                        onClick={handleCsvDataExport}
                        className="px-4 py-2 bg-[#001C3D] hover:bg-[#002D5E] text-[#8EF6D6] hover:text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center gap-2 cursor-pointer border border-[#001C3D]/40 ml-auto xl:ml-0"
                        id="export-raw-csv-verbatim-btn"
                        title={`${globalYear}년 ${globalMonth}월 ${globalDay}일 기준 자료 다운로드`}
                      >
                        <Download className="w-4 h-4 animate-bounce" />
                        <span>[CSV 원시 데이터 추출]</span>
                      </button>
                    </div>
                  </div>

                  {/* Dynamic interactive telemetry feedback charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="analytics-visual-panels">
                    
                    {/* Visual Chart 1: Clip-board Copy Rate */}
                    <div className="bg-white rounded-3xl p-6 border border-slate-150/80 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-black text-[#001C3D]">교사 클립보드 사용율</h4>
                        </div>
                        <span className="text-[10px] bg-slate-100 text-[#001C3D] px-2.5 py-0.5 rounded-full font-mono font-bold">1-Day Window</span>
                      </div>

                      {/* Interactive Telemetry Bar Simulator */}
                      <div className="space-y-3.5 pt-2">
                        <div>
                          <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span className="font-extrabold text-[#001C3D]">가정통신문 제작 (Copy Ingestion Rate)</span>
                            <span className="font-mono font-bold text-slate-600">46% ({Math.round(dynamicCopyVolume * 0.46).toLocaleString()}회)</span>
                          </div>
                          <div className="h-3.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#FF6B6B]" style={{ width: '46%' }}></div>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span className="font-extrabold text-[#001C3D]">누리과정 PPT 교안 (Lesson Planner Ingestion)</span>
                            <span className="font-mono font-bold text-slate-600">28% ({Math.round(dynamicCopyVolume * 0.28).toLocaleString()}회)</span>
                          </div>
                          <div className="h-3.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#FFD93D]" style={{ width: '28%' }}></div>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span className="font-extrabold text-[#001C3D]">학부모 긍정 관찰일지 (Behavior Analytics Tool)</span>
                            <span className="font-mono font-bold text-slate-600">18% ({Math.round(dynamicCopyVolume * 0.18).toLocaleString()}회)</span>
                          </div>
                          <div className="h-3.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#8EF6D6]" style={{ width: '18%' }}></div>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span className="font-extrabold text-[#001C3D]">행사/카드뉴스 문구 (Social Ingestion Tool)</span>
                            <span className="font-mono font-bold text-slate-600">8% ({Math.round(dynamicCopyVolume * 0.08).toLocaleString()}회)</span>
                          </div>
                          <div className="h-3.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-slate-300" style={{ width: '8%' }}></div>
                          </div>
                        </div>
                      </div>

                      {/* Cumulative copy count controller widget */}
                      <div className="bg-[#F5F7FA] rounded-2xl p-4 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold">누적 전체 복사량 (Total Telemetry Copied)</span>
                          <span className="text-xl font-black text-[#001C3D] font-mono">{dynamicCopyVolume.toLocaleString()}회</span>
                        </div>
                        <button
                          onClick={() => {
                            setAnalyticsCopyVolume(prev => prev + 100);
                            triggerToast('Telemetry Mock: 누적 복사 데이터 테스트 볼륨이 100회 상향 가속되었습니다.');
                          }}
                          className="bg-white hover:bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 text-[10px] font-bold text-slate-600 cursor-pointer"
                        >
                          +100 시뮬레이트
                        </button>
                      </div>
                    </div>

                    {/* Visual Chart 2: Canvas Text Edit Volume */}
                    <div className="bg-white rounded-3xl p-6 border border-slate-150/80 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          
                          {/* Styled high-polish dropdown selector title */}
                          <div className="relative z-30">
                            <button
                              type="button"
                              onClick={() => setIsChartViewDropdownOpen(!isChartViewDropdownOpen)}
                              className="text-left font-black text-[#001C3D] hover:text-[#FF6B6B] transition-colors flex items-center gap-1.5 focus:outline-none cursor-pointer group"
                            >
                              <span className="text-sm">
                                {activeChartView === 'volume' && "📊 학급별 템플릿 텍스트 수정량 (Template Text Edit Volume) ▾"}
                                {activeChartView === 'age' && "📊 연령별 프롬프트 편집 볼륨 (Prompt Edit Volume by Age) ▾"}
                                {activeChartView === 'custom' && "📊 학급별 맞춤 프롬프트 작성량 (Customized Prompt Input Volume) ▾"}
                              </span>
                            </button>

                            {/* Dropdown menu to select the view and simulate selectable options */}
                            {isChartViewDropdownOpen && (
                              <>
                                <div
                                  className="fixed inset-0"
                                  onClick={() => setIsChartViewDropdownOpen(false)}
                                />
                                <div className="absolute left-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-30 min-w-[325px] overflow-hidden divide-y divide-slate-100 animate-slideDown">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveChartView('volume');
                                      setIsChartViewDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-3.5 py-2.5 text-xs font-bold transition-colors block cursor-pointer ${
                                      activeChartView === 'volume' ? 'text-[#FF6B6B] bg-slate-50' : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                                  >
                                    학급별 템플릿 텍스트 수정량 (Template Text Edit Volume)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveChartView('age');
                                      setIsChartViewDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-3.5 py-2.5 text-xs font-bold transition-colors block cursor-pointer ${
                                      activeChartView === 'age' ? 'text-[#FF6B6B] bg-slate-50' : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                                  >
                                    연령별 프롬프트 편집 볼륨 (Prompt Edit Volume by Age)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveChartView('custom');
                                      setIsChartViewDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-3.5 py-2.5 text-xs font-bold transition-colors block cursor-pointer ${
                                      activeChartView === 'custom' ? 'text-[#FF6B6B] bg-slate-50' : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                                  >
                                    학급별 맞춤 프롬프트 작성량 (Customized Prompt Input Volume)
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] bg-slate-100 text-[#001C3D] px-2.5 py-0.5 rounded-full font-mono font-bold">Realtime Thread</span>
                      </div>

                      {/* Bar graph / Custom SVG visual grid representing quantitative research curves */}
                      <div className="h-36 flex items-end justify-between gap-1 border-b border-l border-slate-200 pb-2 pl-2">
                        {(() => {
                          const baseMap = {
                            volume: [
                              { val: 40, label: '만 0세' },
                              { val: 65, label: '만 1세' },
                              { val: 85, label: '만 2세' },
                              { val: 120, label: '만 3세햇살' },
                              { val: 95, label: '만 4세' },
                              { val: 110, label: '만 5세' },
                              { val: 50, label: '기타교란' }
                            ],
                            age: [
                              { val: 30, label: '만 0세' },
                              { val: 50, label: '만 1세' },
                              { val: 115, label: '만 2세' },
                              { val: 80, label: '만 3세햇살' },
                              { val: 110, label: '만 4세' },
                              { val: 75, label: '만 5세' },
                              { val: 90, label: '기타교란' }
                            ],
                            custom: [
                              { val: 85, label: '만 0세' },
                              { val: 45, label: '만 1세' },
                              { val: 65, label: '만 2세' },
                              { val: 100, label: '만 3세햇살' },
                              { val: 125, label: '만 4세' },
                              { val: 60, label: '만 5세' },
                              { val: 70, label: '기타교란' }
                            ]
                          };
                          
                          const currentList = baseMap[activeChartView] || baseMap.volume;
                          return currentList.map((bar, idx) => {
                            const shift = ((bar.val * (dateSeed ?? 0)) % 31) - 15;
                            const finalVal = Math.max(15, Math.min(130, bar.val + shift));
                            return (
                              <div key={idx} className="flex-1 flex flex-col items-center group relative">
                                {/* Hover detail tooltip */}
                                <div className="opacity-0 group-hover:opacity-100 absolute -top-10 bg-slate-900 text-white text-[10px] py-1 px-1.5 rounded-md z-10 transition-opacity whitespace-nowrap">
                                  수정량: {finalVal}단어 / 회
                                </div>
                                {/* Colorful responsive bar */}
                                <div
                                  className="w-full rounded-t bg-gradient-to-t from-[#001C3D] to-[#FF6B6B] group-hover:to-[#FFD93D] transition-all cursor-pointer animate-fadeIn"
                                  style={{ height: `${(finalVal / 130) * 100}px` }}
                                ></div>
                                <span className="text-[9px] text-slate-400 mt-1 text-center scale-90 whitespace-nowrap font-bold">
                                  {bar.label}
                                </span>
                              </div>
                            );
                          });
                        })()}
                      </div>

                      {/* Cumulative edits widget */}
                      <div className="bg-[#F5F7FA] rounded-2xl p-4 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold">총 텍스트 수정 및 편집 볼륨 (Total Tokens Edited)</span>
                          <span className="text-xl font-black text-[#001C3D] font-mono">{dynamicEditVolume.toLocaleString()} 단어</span>
                        </div>
                        <button
                          onClick={() => {
                            setAnalyticsEditVolume(prev => prev + 250);
                            triggerToast('Telemetry Mock: 문항 조립 가변 검수량이 250 단어 가산되었습니다.');
                          }}
                          className="bg-white hover:bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 text-[10px] font-bold text-[#001C3D] cursor-pointer"
                        >
                          +250 시뮬레이트
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 5. Teacher Growth Report & Praise (Gamification & Supportive element) */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-150 shadow-sm font-sans">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 mb-4 gap-3">
                      <div>
                        <h4 className="text-base font-black text-[#001C3D] flex items-center gap-1.5">
                          <Award className="w-4 h-4 text-[#FF6B6B]" />
                          교사 활용 데이터
                        </h4>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[10px] sm:inline-block hidden font-mono font-bold bg-[#E8FBF4] text-[#059669] px-2.5 py-0.5 rounded-full">
                          {teachers.length}명의 현역교사 연동 중
                        </span>

                        {/* Dropdown filter for Specific institutions */}
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-slate-500 whitespace-nowrap">[🏫 기관별 필터링 ▾]</span>
                          <select
                            value={institutionFilter}
                            onChange={(e) => setInstitutionFilter(e.target.value)}
                            className="text-xs font-bold bg-slate-50 border border-slate-200 text-slate-700 py-1 px-2.5 rounded-lg cursor-pointer transition-colors focus:ring-1 focus:ring-[#FF6B6B] focus:outline-none"
                          >
                            <option value="전체">전체 기관</option>
                            <option value="해오름 유치원">해오름 유치원</option>
                            <option value="새싹 어린이집">새싹 어린이집</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Table showing 'Teacher Growth & Gamification' as requested */}
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left" id="gamification-teachers-table">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                            <th className="py-3 px-4">이름 (Name)</th>
                            <th className="py-3 px-4">소속 기관 (Institution)</th>
                            <th className="py-3 px-4">대표 뱃지 (Badge)</th>
                            <th className="py-3 px-4 text-center">누적 활용 빈도 (Utilization Count)</th>
                            <th className="py-3 px-4 text-center">선물 및 칭찬 지원 (Actions)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-sm">
                          {dynamicTeachersList
                            .filter(t => institutionFilter === '전체' || t.institution === institutionFilter)
                            .map(t => (
                            <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-4 px-4 font-bold text-slate-800">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-lg bg-[#001C3D]/10 text-[#001C3D] text-[11px] font-black flex items-center justify-center">
                                    {t.name.slice(0, 1)}
                                  </div>
                                  <span>{t.name}</span>
                                </div>
                              </td>
                              <td className="py-4 px-4">
                                <button
                                  onClick={() => setInstitutionFilter(t.institution || '전체')}
                                  title={`${t.institution || '기관'}만 보기`}
                                  className="text-xs font-semibold text-slate-500 hover:text-[#001C3D] underline decoration-dotted underline-offset-4 cursor-pointer hover:bg-slate-100/50 px-1.5 py-0.5 rounded transition-all text-left"
                                >
                                  {t.institution || '일반 기관'}
                                </button>
                              </td>
                              <td className="py-4 px-4">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ring-1 ring-slate-100 ${
                                  t.badgeColor === 'mint' ? 'bg-[#E8FBF4] text-[#059669]' :
                                  t.badgeColor === 'yellow' ? 'bg-[#FFF9E6] text-[#D97706]' :
                                  t.badgeColor === 'coral' ? 'bg-[#FFF1F2] text-[#E11D48]' :
                                  'bg-[#F0F2F5] text-[#334155]'
                                }`}>
                                  ⭐ [{t.badge}]
                                </span>
                              </td>
                              <td className="py-4 px-4 text-center font-mono font-bold text-[#001C3D]">
                                {t.runs}회 호출
                              </td>
                              <td className="py-4 px-4">
                                <div className="flex items-center justify-center gap-2">
                                  
                                  {/* Action button labeled verbatim with [선물 보내기] */}
                                  <button
                                    id={`btn-gift-verbatim-${t.id}`}
                                    onClick={() => handleSendGift(t.id, t.name)}
                                    className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-accent-coral hover:bg-accent-coral/5 text-slate-700 hover:text-accent-coral text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                                  >
                                    <Gift className="w-3.5 h-3.5 text-rose-500" />
                                    <span>[선물 보내기]</span>
                                  </button>

                                  {/* Action button labeled verbatim with [칭찬 스티커 발송] */}
                                  <button
                                    id={`btn-sticker-verbatim-${t.id}`}
                                    onClick={() => handleSendSticker(t.id, t.name)}
                                    className="px-3 py-1.5 rounded-xl bg-[#001C3D] hover:bg-[#002D5E] text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                                  >
                                    <Smile className="w-3.5 h-3.5 text-yellow-300" />
                                    <span>[칭찬 스티커 발송]</span>
                                  </button>

                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

              {adminTab === 'folders' && (() => {
                // Calculate folder statistics
                const totalPersonal = personalFolders.length;
                const totalShared = sharedFolders.length;
                const totalLocked = Object.values(lockedFolders).filter(Boolean).length;
                
                // Group documents by folders to show a real visual tree map!
                const sharedTree = sharedFolders.reduce((acc, folder) => {
                  acc[folder] = sharedRepositoryPrompts.filter(p => p.category === folder);
                  return acc;
                }, {} as Record<string, typeof sharedRepositoryPrompts>);

                const personalTree = personalFolders.reduce((acc, folder) => {
                  acc[folder] = savedUserPrompts.filter(p => p.category === folder);
                  return acc;
                }, {} as Record<string, typeof savedUserPrompts>);

                // Handler to create new official/standard folders from admin
                const handleCreateOfficialFolder = (e: React.FormEvent) => {
                  e.preventDefault();
                  const folderName = newOfficialFolderInput.trim();
                  if (!folderName) {
                    triggerToast('⚠️ 공식 폴더 이름을 입력해 주십시오.');
                    return;
                  }

                  if (mergeFolderType === 'shared') {
                    if (sharedFolders.includes(folderName)) {
                      triggerToast('⚠️ 이미 존재하는 원 공용 폴더명입니다.');
                      return;
                    }
                    setSharedFolders(prev => [...prev, folderName]);
                    // Auto-lock new official folders
                    setLockedFolders(prev => ({ ...prev, [folderName]: true }));
                    triggerToast(`📁 원 공용 공식 폴더 [${folderName}]가 장부 등록되었으며 '잠금(Locked)'처리되었습니다.`);
                  } else {
                    if (personalFolders.includes(folderName)) {
                      triggerToast('⚠️ 이미 존재하는 교직원 개인 폴더명입니다.');
                      return;
                    }
                    setPersonalFolders(prev => [...prev, folderName]);
                    setLockedFolders(prev => ({ ...prev, [folderName]: true }));
                    triggerToast(`📁 교사 개인 공식 폴더 [${folderName}]가 장부 등록되었으며 '잠금(Locked)'처리되었습니다.`);
                  }
                  setNewOfficialFolderInput('');
                };

                // Handler to execute consolidate merge
                const handleExecuteMerge = () => {
                  if (selectedMergeSources.length === 0) {
                    triggerToast('⚠️ 통폐합할 원천 소스 폴더를 1개 이상 선택하십시오.');
                    return;
                  }
                  if (!mergeTargetFolder) {
                    triggerToast('⚠️ 합치 통폐합 대상을 이식받을 목적지 폴더를 선택하십시오.');
                    return;
                  }
                  if (selectedMergeSources.includes(mergeTargetFolder)) {
                    triggerToast('⚠️ 대상 표적 폴더는 통폐합 소스 목록에 중복으로 포함될 수 없습니다.');
                    return;
                  }

                  let migratedCount = 0;

                  if (mergeFolderType === 'shared') {
                    // Update document associations
                    setSharedRepositoryPrompts(prev => prev.map(p => {
                      if (selectedMergeSources.includes(p.category)) {
                        migratedCount++;
                        return { ...p, category: mergeTargetFolder, status: '분류됨' };
                      }
                      return p;
                    }));

                    // Pull out merged folders from sharedFolders state
                    setSharedFolders(prev => prev.filter(f => !selectedMergeSources.includes(f)));
                    triggerToast(`🤝 [우리 원 문서함] ${selectedMergeSources.map(s => `[${s}]`).join(', ')} 폴더가 [${mergeTargetFolder}] 폴더로 완전 병합(Merge)되었습니다! (대상 영양소 이관: ${migratedCount}건)`);
                  } else {
                    // Personal Folder Merge
                    setSavedUserPrompts(prev => prev.map(p => {
                      if (selectedMergeSources.includes(p.category)) {
                        migratedCount++;
                        return { ...p, category: mergeTargetFolder };
                      }
                      return p;
                    }));

                    // Pull out merged folders from personalFolders state
                    setPersonalFolders(prev => prev.filter(f => !selectedMergeSources.includes(f)));
                    triggerToast(`🤝 [개인 문서고] ${selectedMergeSources.map(s => `[${s}]`).join(', ')} 폴더가 [${mergeTargetFolder}] 폴더로 완전 병합(Merge)되었습니다! (대상 영양소 이관: ${migratedCount}건)`);
                  }

                  // Clear merging settings
                  setSelectedMergeSources([]);
                  setMergeTargetFolder('');
                };

                return (
                  <div className="space-y-6 p-6 overflow-y-auto w-full max-h-[calc(100vh-80px)]" id="admin-folder-governance-panel">
                    {/* Header Banner */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-4">
                      <div>
                        <h2 className="text-2xl font-black text-[#001C3D] flex items-center gap-2">
                          <FolderSync className="w-5 h-5 text-emerald-600" />
                          <span>통합 폴더 거버넌스 (Folder Governance)</span>
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                          원내 모든 교사들이 생성한 문서함 폴더의 구조를 한눈에 통제하고, 중복 폴더의 병합(Merge) 및 공식 잠금(Lock) 처리를 일괄 집행하는 지식 관리 사령탑입니다.
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="font-bold text-slate-400">교사 작업 현장 연동중</span>
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                        </div>
                        <button
                          type="button"
                          onClick={restoreFoldersToStandard}
                          className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md hover:shadow-lg cursor-pointer transform hover:-translate-y-0.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-white animate-spin" />
                          <span>⚙️ [Restore to Standard] 표준 환원 복구</span>
                        </button>
                      </div>
                    </div>

                    {/* Bento Quick Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">공용 표준 폴더 양</p>
                        <p className="text-2xl font-black text-[#001C3D] mt-1">{totalShared}개</p>
                        <span className="text-[10px] text-slate-400 mt-1 block">가정통신문, 안내문 등 내장</span>
                      </div>
                      <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">교직원 개인 전유 폴더</p>
                        <p className="text-2xl font-black text-rose-500 mt-1">{totalPersonal}개</p>
                        <span className="text-[10px] text-slate-400 mt-1 block font-medium">개인 수납용 하위 디렉토리 수</span>
                      </div>
                      <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">표준 잠금 고정율 (Lock Ratio)</p>
                        <p className="text-2xl font-black text-blue-600 mt-1">
                          {Math.round((totalLocked / ((totalPersonal + totalShared) || 1)) * 100)}%
                        </p>
                        <span className="text-[10px] text-emerald-600 mt-1 block font-semibold">🔒 {totalLocked}개 폴더 수정금지 보호</span>
                      </div>
                      <div className="bg-indigo-900 text-white p-5 rounded-2xl shadow-xs relative overflow-hidden">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-indigo-300">거버넌스 정합성 등급</p>
                        <p className="text-base font-black mt-2">안정적인 체제 유지</p>
                        <span className="text-[9.5px] text-indigo-200 mt-1 block font-medium">충돌 중복 지표 정상 관리됨</span>
                      </div>
                    </div>

                    {/* Main Workspace: Left (Visual Tree View), Right (Operations Command) */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      
                      {/* Left Block: Visual Tree View */}
                      <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                          <div>
                            <h3 className="text-sm font-black text-[#001C3D] flex items-center gap-1.5">
                              <Sliders className="w-4 h-4 text-emerald-500" />
                              실시간 전계 계통수 트리 맵 (Real-Time Visual Tree View)
                            </h3>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              원내 주임 교직원들이 수확한 문서들과 템플릿들이 폴더별로 인입 부스팅된 실시간 계통 트리입니다.
                            </p>
                          </div>
                        </div>

                        {/* Visual trees list */}
                        <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
                          
                          {/* Part A: Shared Storage Tree */}
                          <div className="space-y-3">
                            <div className="flex items-center gap-1.5 bg-slate-50 py-1.5 px-3 rounded-lg border border-slate-200/60">
                              <Globe className="w-3.5 h-3.5 text-purple-500" />
                              <span className="text-xs font-black text-slate-700">🌐 공용 저장소 통합 폴더 트리 (Shared Repository Tree)</span>
                            </div>

                            <div className="pl-4 border-l-2 border-dashed border-slate-200/80 space-y-2">
                              {sharedFolders.map(folder => {
                                const docs = sharedTree[folder] || [];
                                const isLocked = lockedFolders[folder];
                                
                                return (
                                  <div key={`tree-shared-${folder}`} className="relative pl-4 space-y-1">
                                    <div className="absolute left-0 top-[14px] w-3.5 border-b border-dashed border-slate-200" />
                                    
                                    {/* Folder Node Wrapper */}
                                    <div className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                                      modifiedFolders[folder]
                                        ? 'bg-amber-50/80 border-amber-300 shadow-sm'
                                        : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200/60'
                                    }`}>
                                      <div className="flex items-center gap-2">
                                        <span className="text-base">{isLocked ? '🔒' : '📁'}</span>
                                        <div>
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-xs font-black text-slate-800 flex items-center gap-1">
                                              <span>{folder}</span>
                                              {OFFICIAL_FOLDERS.includes(folder) && (
                                                <span className="text-amber-500 font-black text-xs" title="★ 원내 규정 공식 지정 폴더">★</span>
                                              )}
                                            </span>
                                            {isLocked && (
                                              <span className="text-[8px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-black border border-blue-200/60">
                                                공식 기준 잠금
                                              </span>
                                            )}
                                            {modifiedFolders[folder] && (
                                              <span className="text-[8px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-black border border-amber-250 animate-pulse flex items-center gap-0.5">
                                                <span>⚠️</span> 교사 수정됨
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-[9px] text-slate-400 font-medium">수집 정렬물: {docs.length}개</p>
                                        </div>
                                      </div>

                                      {/* Quick actions inside tree node */}
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (folder === '미분류') {
                                              triggerToast('⚠️ [미분류] 기본 폴더는 성격을 잠금 변경할 수 없습니다.');
                                              return;
                                            }
                                            toggleFolderLock(folder);
                                          }}
                                          className={`text-[9.5px] font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                                            isLocked
                                              ? 'bg-blue-50 border-blue-200 text-blue-650 hover:bg-blue-100'
                                              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                          }`}
                                        >
                                          {isLocked ? '잠금해제' : '행정잠금'}
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (isLocked) {
                                              triggerToast('🔒 이 폴더는 행제 잠금 보안 보호 대상이므로 이름 개칭이 봉쇄되었습니다.');
                                              return;
                                            }
                                            const newName = window.prompt(`[${folder}] 공용 폴더의 새 이름을 입력하십시오:`, folder);
                                            if (newName && newName.trim() && newName.trim() !== folder) {
                                              renameFolder('shared', folder, newName.trim());
                                            }
                                          }}
                                          className="text-[9.5px] font-bold bg-white border border-slate-200 hover:border-slate-350 text-slate-650 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                                        >
                                          이름변경
                                        </button>
                                      </div>
                                    </div>

                                    {/* Document leaves under folder node */}
                                    {docs.length > 0 ? (
                                      <div className="pl-6 pt-1 space-y-1">
                                        {docs.map(doc => (
                                          <div
                                            key={`leaf-shared-${doc.id}`}
                                            className="flex items-center gap-1.5 text-[10.5px] text-slate-650 hover:text-slate-900 py-1 px-1.5 rounded transition-all leading-relaxed"
                                          >
                                            <span className="text-slate-400">├ 📄</span>
                                            <span className="font-extrabold text-indigo-600 text-[10px]">[{doc.author}]</span>
                                            <span className="truncate max-w-sm">{doc.title}</span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="pl-6 py-1 text-[9px] text-slate-400 italic">└ 적재 기입안 없음</div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Part B: Personal Client Storage Tree */}
                          <div className="space-y-3 pt-2">
                            <div className="flex items-center gap-1.5 bg-slate-50 py-1.5 px-3 rounded-lg border border-slate-200/60">
                              <Folder className="w-3.5 h-3.5 text-rose-500" />
                              <span className="text-xs font-black text-slate-700">📁 교사 개인 보관 드로어 트리 (Personal Drawer Tree)</span>
                            </div>

                            <div className="pl-4 border-l-2 border-dashed border-slate-200/80 space-y-2">
                              {personalFolders.map(folder => {
                                const docs = personalTree[folder] || [];
                                const isLocked = lockedFolders[folder];

                                return (
                                  <div key={`tree-personal-${folder}`} className="relative pl-4 space-y-1">
                                    <div className="absolute left-0 top-[14px] w-3.5 border-b border-dashed border-slate-200" />
                                    
                                    {/* Folder Node Wrapper */}
                                    <div className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                                      modifiedFolders[folder]
                                        ? 'bg-amber-50/80 border-amber-300 shadow-sm'
                                        : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200/60'
                                    }`}>
                                      <div className="flex items-center gap-2">
                                        <span className="text-base">{isLocked ? '🔒' : '📁'}</span>
                                        <div>
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-xs font-black text-slate-800 flex items-center gap-1">
                                              <span>{folder}</span>
                                              {OFFICIAL_FOLDERS.includes(folder) && (
                                                <span className="text-amber-500 font-black text-xs" title="★ 원내 규정 공식 지정 폴더">★</span>
                                              )}
                                            </span>
                                            {isLocked && (
                                              <span className="text-[8px] bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded font-black border border-rose-200/60">
                                                개인 표준 보호
                                              </span>
                                            )}
                                            {modifiedFolders[folder] && (
                                              <span className="text-[8px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-black border border-amber-250 animate-pulse flex items-center gap-0.5">
                                                <span>⚠️</span> 교사 수정됨
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-[9px] text-slate-400 font-medium">수집 정렬물: {docs.length}개</p>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (folder === '미분류') {
                                              triggerToast('⚠️ [미분류] 폴더 잠금 해제는 불허됩니다.');
                                              return;
                                            }
                                            toggleFolderLock(folder);
                                          }}
                                          className={`text-[9.5px] font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                                            isLocked
                                              ? 'bg-rose-50 border-rose-200 text-rose-650 hover:bg-rose-100'
                                              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                          }`}
                                        >
                                          {isLocked ? '잠금해제' : '표준지정'}
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (isLocked) {
                                              triggerToast('🔒 이 폴더는 표준 격식으로 제동 장치 복무 중이므로 이름 수리가 불가합니다.');
                                              return;
                                            }
                                            const newName = window.prompt(`[${folder}] 개인 폴더의 새 이름을 지정하십시오:`, folder);
                                            if (newName && newName.trim() && newName.trim() !== folder) {
                                              renameFolder('personal', folder, newName.trim());
                                            }
                                          }}
                                          className="text-[9.5px] font-bold bg-white border border-slate-200 hover:border-slate-350 text-slate-650 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                                        >
                                          이름변경
                                        </button>
                                      </div>
                                    </div>

                                    {/* Personal doc leaves under folder nodes */}
                                    {docs.length > 0 ? (
                                      <div className="pl-6 pt-1 space-y-1">
                                        {docs.map(doc => (
                                          <div
                                            key={`leaf-personal-${doc.id}`}
                                            className="flex items-center gap-1.5 text-[10.5px] text-slate-600 hover:text-slate-900 py-1 px-1.5 rounded transition-all leading-relaxed"
                                          >
                                            <span className="text-slate-400">└ 📄</span>
                                            <span className="truncate max-w-sm">{doc.title}</span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="pl-6 py-1 text-[9px] text-slate-400 italic">└ 개인 보관 문서물 없음</div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                        </div>
                      </div>

                      {/* Right Block: Administration Operations */}
                      <div className="lg:col-span-5 space-y-6">
                        
                        {/* Box 1: Create Standard Official Folder */}
                        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                          <div>
                            <h3 className="text-sm font-black text-[#001C3D] flex items-center gap-1.5">
                              <Plus className="w-4 h-4 text-emerald-500" />
                              새 표준 가이드 폴더 기획 발행
                            </h3>
                            <p className="text-[11px] text-slate-500">
                              원내 규정에 의거하여 현업 교사들에게 하드마운팅 보급할 새 표준 규격 함대를 즉각 기획 신설합니다.
                            </p>
                          </div>

                          <div className="space-y-3 pt-1">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-450 mb-1">■ 폴더 목적지 대분류 저장소</label>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setMergeFolderType('shared')}
                                  className={`py-2 px-3 rounded-xl border text-center text-xs font-black transition-all cursor-pointer ${
                                    mergeFolderType === 'shared'
                                      ? 'bg-purple-50 border-purple-400 text-purple-850'
                                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                  }`}
                                >
                                  🌐 원 공용 문서함
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setMergeFolderType('personal')}
                                  className={`py-2 px-3 rounded-xl border text-center text-xs font-black transition-all cursor-pointer ${
                                    mergeFolderType === 'personal'
                                      ? 'bg-rose-50 border-rose-450 text-rose-850'
                                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                  }`}
                                >
                                  📂 일선 개인 보관함
                                </button>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-450 mb-1">■ 신설 수납 명명안</label>
                              <input
                                type="text"
                                value={newOfficialFolderInput}
                                onChange={(e) => setNewOfficialFolderInput(e.target.value)}
                                placeholder="예: 봄학기행사, 오감관찰 등"
                                className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-2.5 py-2.5 bg-slate-50/50 hover:bg-indigo-50/10 focus:bg-white focus:outline-none focus:border-emerald-500 text-slate-808"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={handleCreateOfficialFolder}
                              className="w-full py-3 bg-slate-900 text-white hover:bg-emerald-600 rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-sm hover:shadow-md"
                            >
                              [📁 새 공식 표준 폴더 보급 기획집행]
                            </button>
                          </div>
                        </div>

                        {/* Box 2: Bulk duplicate Merge Consolidation Tools */}
                        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                          <div>
                            <h3 className="text-xs font-black text-rose-600 flex items-center gap-1.5 uppercase tracking-wider">
                              🤝 중복 규격 폴더 통폐합 거버넌스 도구 (Bulk Merge Center)
                            </h3>
                            <p className="text-[11px] text-slate-500 leading-normal">
                              기획이 유사하거나 파편 생성 누적된 수합 서납들을 하나로 긴밀 통폐합하고 문서를 자동 이식시킵니다.
                            </p>
                          </div>

                          <div className="space-y-4 pt-1 font-sans">
                            {/* Toggle Folder target group */}
                            <div>
                              <span className="block text-[10px] font-bold text-slate-400 mb-1.5">
                                STEP 1: 병합 대상 저장 분류계 정보
                              </span>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMergeFolderType('shared');
                                    setSelectedMergeSources([]);
                                    setMergeTargetFolder('');
                                  }}
                                  className={`py-1.5 px-2.5 rounded-lg border text-center text-[10.5px] font-extrabold transition-all cursor-pointer ${
                                    mergeFolderType === 'shared'
                                      ? 'bg-purple-100 border-purple-308 text-purple-800'
                                      : 'bg-white border-slate-200 text-slate-500'
                                  }`}
                                >
                                  우리 원 문서함 병합
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMergeFolderType('personal');
                                    setSelectedMergeSources([]);
                                    setMergeTargetFolder('');
                                  }}
                                  className={`py-1.5 px-2.5 rounded-lg border text-center text-[10.5px] font-extrabold transition-all cursor-pointer ${
                                    mergeFolderType === 'personal'
                                      ? 'bg-rose-100 border-rose-308 text-rose-800'
                                      : 'bg-white border-slate-200 text-slate-500'
                                  }`}
                                >
                                  교사 개인 서랍 병합
                                </button>
                              </div>
                            </div>

                            {/* Select source folders */}
                            <div>
                              <span className="block text-[10px] font-bold text-slate-400 mb-1.5">
                                STEP 2: 통폐합하여 삭제 소멸시킬 중복 유기 소스들 (복수 선택)
                              </span>
                              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 max-h-[120px] overflow-y-auto space-y-1.5">
                                {(mergeFolderType === 'shared' ? sharedFolders : personalFolders)
                                  .filter(f => f !== '미분류')
                                  .map(folder => {
                                    const isSelected = selectedMergeSources.includes(folder);
                                    return (
                                      <label
                                        key={`merge-src-${folder}`}
                                        className="flex items-center gap-2 text-[11px] font-bold text-slate-700 hover:text-black cursor-pointer pb-1 border-b border-dashed border-slate-100"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => {
                                            if (isSelected) {
                                              setSelectedMergeSources(prev => prev.filter(s => s !== folder));
                                            } else {
                                              setSelectedMergeSources(prev => [...prev, folder]);
                                            }
                                          }}
                                          className="rounded text-indigo-650 focus:ring-indigo-500"
                                        />
                                        <span>📁 {folder}</span>
                                      </label>
                                    );
                                  })}
                                {(mergeFolderType === 'shared' ? sharedFolders : personalFolders).filter(f => f !== '미분류').length === 0 && (
                                  <p className="text-[10px] text-slate-400 italic text-center py-2">병합 정리할 대상 폴더가 비어 있습니다.</p>
                                )}
                              </div>
                            </div>

                            {/* Select final destination folder */}
                            <div>
                              <span className="block text-[10px] font-bold text-slate-400 mb-1.5">
                                STEP 3: 최종 이식을 수렴받을 타겟 표준 가이드함 대선배 지정
                              </span>
                              <select
                                value={mergeTargetFolder}
                                onChange={(e) => setMergeTargetFolder(e.target.value)}
                                className="w-full text-xs font-semibold border border-slate-200 bg-white rounded-xl px-2.5 py-2.5 focus:outline-none focus:border-purple-500 text-slate-808"
                              >
                                <option value="">-- 이주 표적 수납함 지정 --</option>
                                {(mergeFolderType === 'shared' ? sharedFolders : personalFolders)
                                  .filter(f => !selectedMergeSources.includes(f))
                                  .map(folder => (
                                    <option key={`merge-tgt-${folder}`} value={folder}>
                                      📥 {folder} {folder === '미분류' && '(미분류함 수렵 통합)'}
                                    </option>
                                  ))}
                              </select>
                            </div>

                            <button
                              type="button"
                              onClick={handleExecuteMerge}
                              className="w-full py-3 bg-gradient-to-r from-red-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 transform hover:-translate-y-0.5 active:scale-98"
                            >
                              <span>🤝 [선택한 {selectedMergeSources.length}개 유치부 폴더 완벽 통합 집행]</span>
                            </button>
                          </div>
                        </div>

                        {/* Box 3: Governance Audit Trail (Background Action Logs) */}
                        <div className="bg-slate-900 text-slate-100 rounded-3xl p-5 border border-slate-800 shadow-xl space-y-4 font-mono">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#FFD93D] animate-ping"></span>
                              <h3 className="text-xs font-black text-rose-450 tracking-wider flex items-center gap-1.5">
                                🛡️ 실시간 행정 보안 감사 로그 (Audit Trail)
                              </h3>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setAuditLogs([{
                                  id: 'log-clear',
                                  timestamp: new Date().toLocaleTimeString('ko-KR', { hourCycle: 'h23' }),
                                  action: '로그 청소',
                                  details: '관리감독관 지휘하에 감사 이력 버퍼가 정상 청소 처리되었습니다.',
                                  isTeacher: false
                                }]);
                                triggerToast('🧹 실시간 보안 감사 화면 로그 버퍼가 초기화되었습니다.');
                              }}
                              className="text-[9px] bg-slate-850 hover:bg-slate-700 text-slate-400 font-bold px-2 py-1 rounded"
                            >
                              로그 지우기
                            </button>
                          </div>

                          <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                            {auditLogs.map(log => (
                              <div key={log.id} className="text-[10.5px] leading-relaxed border-b border-slate-800/60 pb-2">
                                <span className="text-slate-500">[{log.timestamp}]</span>{' '}
                                <span className="text-[#FFD93D] font-extrabold">{log.action}:</span>{' '}
                                <span className="text-slate-300">{log.details}</span>
                              </div>
                            ))}
                          </div>

                          <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                            원내 교직원 및 행정 사령탑이 집행하는 모든 폴더 창설, 잠금, 삭제, 개칭 행동기록이 인가 사보타주 방지를 위해 실시간 무중단 기록됩니다.
                          </p>
                        </div>

                      </div>

                    </div>
                  </div>
                );
              })()}

              {/* Sync tab moved to secret modal */}

            </main>
          </div>
        )}

      </div>

      {/* ==============================================================
          C. RIGHT-SIDE SLIDING DRAWER: Integrated Archives (보관함)
          ============================================================== */}
      <AnimatePresence>
        {isSavedDrawerOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden" id="saved-prompt-cabinet-modal">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSavedDrawerOpen(false)}
              className="fixed inset-0 bg-black"
            />

            <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="w-screen max-w-5xl bg-white shadow-2xl flex flex-col justify-between"
              >
                {/* Drawer Header */}
                <div className="px-6 py-5 bg-[#001C3D] text-white flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FolderSync className="w-5 h-5 text-[#FFD93D]" />
                      <div>
                        <h3 className="text-base font-bold font-sans text-white">보관함</h3>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsSavedDrawerOpen(false)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Two-Tiered Tab Selection */}
                  <div className="flex bg-slate-900/60 p-1 rounded-xl border border-slate-700/50 max-w-md">
                    <button
                      onClick={() => {
                        setArchiveTab('personal');
                        setActiveCabinetFolderFilter('전체');
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        triggerToast('📂 내 보관함은 본인의 임시 초안이 저장되는 사적 영역입니다.');
                      }}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                        archiveTab === 'personal'
                          ? 'bg-[#FF6B6B] text-white shadow-sm font-black'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Folder className="w-3.5 h-3.5" />
                      <span>내 보관함 ({savedUserPrompts.length})</span>
                    </button>
                    <button
                      onClick={() => {
                        setArchiveTab('shared');
                        setActiveCabinetFolderFilter('전체');
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const cardId = e.dataTransfer.getData('text/plain');
                        const targetCard = savedUserPrompts.find(item => item.id === cardId);
                        if (targetCard) {
                           promoteToSharedRepository(targetCard, e.clientX, e.clientY);
                        }
                      }}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 border border-transparent ${
                        archiveTab === 'shared'
                          ? 'bg-blue-600 text-white shadow-sm font-black'
                          : 'text-slate-400 hover:text-[#8EF6D6] hover:bg-slate-800/40'
                      }`}
                      title="드래그 드롭으로 간편히 공유 가능"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>우리 원 보관함 ({sharedRepositoryPrompts.length})</span>
                    </button>
                  </div>
                </div>

                {/* 2-Column Main Workspace */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 overflow-hidden bg-slate-50">
                  
                  {/* LEFT COLUMN: Folder Tree System (1/3 Width) */}
                  <div className="md:col-span-1 border-r border-slate-200 bg-white p-4 flex flex-col justify-between overflow-y-auto min-h-[300px]">
                    <div className="space-y-4">

                      <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-0.5 custom-scrollbar">
                        {/* 2. Directory Nodes Mapping */}
                        {(archiveTab === 'personal' ? personalFolders : sharedFolders).map(folder => {
                          const isSelected = activeCabinetFolderFilter === folder;
                          const isLocked = lockedFolders[folder];
                          const isOfficial = OFFICIAL_FOLDERS.includes(folder);
                          const isModified = modifiedFolders[folder];
                          const isEdited = editingFolder?.type === archiveTab && editingFolder?.name === folder;
                          const showMenu = activeMenuFolder?.type === archiveTab && activeMenuFolder?.name === folder;

                          return (
                            <div
                              key={folder}
                              onClick={() => {
                                if (!isEdited) {
                                  setActiveCabinetFolderFilter(folder);
                                }
                              }}
                              className={`group relative flex items-center justify-between p-2.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                                isSelected
                                  ? archiveTab === 'personal'
                                    ? 'bg-rose-50 border-rose-200 text-rose-700 font-black shadow-sm'
                                    : 'bg-indigo-50 border-indigo-200 text-indigo-750 font-black shadow-sm'
                                  : 'bg-white border-slate-200/60 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex-1 flex items-center gap-2 truncate">
                                <span className="text-xs">{isLocked ? '🔒' : '📁'}</span>
                                {isEdited ? (
                                  <input
                                    type="text"
                                    autoFocus
                                    value={editingFolderNameValue}
                                    onChange={(e) => setEditingFolderNameValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        renameFolder(archiveTab, folder, editingFolderNameValue);
                                        setEditingFolder(null);
                                      } else if (e.key === 'Escape') {
                                        setEditingFolder(null);
                                      }
                                    }}
                                    onBlur={() => {
                                      renameFolder(archiveTab, folder, editingFolderNameValue);
                                      setEditingFolder(null);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="border border-[#FF6B6B] bg-white text-[11px] px-2 py-0.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF6B6B] font-bold text-slate-800 w-full"
                                  />
                                ) : (
                                  <span className="truncate flex items-center gap-1.5">
                                    <span className={isSelected ? 'font-black text-slate-900' : 'text-slate-700'}>{folder}</span>
                                    {isOfficial && (
                                      <span className="text-amber-500 text-xs font-black" title="★ 원내 규정 공식 지정 폴더">★</span>
                                    )}
                                    {isModified && (
                                      <span className="text-[8px] bg-amber-55 text-amber-800 border border-amber-200 px-1 rounded animate-pulse font-black">수정됨</span>
                                    )}
                                  </span>
                                )}
                              </div>

                              {/* Operations Options Button */}
                              {!isEdited && (
                                <div className="relative flex items-center" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (activeMenuFolder?.name === folder && activeMenuFolder?.type === archiveTab) {
                                        setActiveMenuFolder(null);
                                      } else {
                                        setActiveMenuFolder({ type: archiveTab, name: folder });
                                      }
                                    }}
                                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all opacity-0 group-hover:opacity-100"
                                  >
                                    <MoreVertical className="w-3.5 h-3.5" />
                                  </button>

                                  {showMenu && (
                                    <div className="absolute right-0 top-6 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 min-w-[110px] z-[99] text-left">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (isLocked && !isAdminMode) {
                                            triggerToast('🔒 이 폴더는 원내 지침 보정에 의해 보호 지정되어 있습니다.');
                                          } else {
                                            setEditingFolder({ type: archiveTab, name: folder });
                                            setEditingFolderNameValue(folder);
                                          }
                                          setActiveMenuFolder(null);
                                        }}
                                        className="w-full text-left px-3 py-1.5 text-[10.5px] font-bold text-slate-705 hover:bg-slate-50 flex items-center gap-1.5"
                                      >
                                        <span>✏️</span> 이름 변경
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (folder === '미분류') {
                                            triggerToast('⚠️ [미분류] 기본 폴더는 파기할 수 없습니다.');
                                            return;
                                          }
                                          if (isLocked && !isAdminMode) {
                                            triggerToast('🔒 이 폴더는 관리 정책상 삭제 조치가 거부 처리되었습니다.');
                                            return;
                                          }
                                          deleteFolder(archiveTab, folder);
                                          setActiveMenuFolder(null);
                                        }}
                                        className="w-full text-left px-3 py-1.5 text-[10.5px] font-bold text-red-650 hover:bg-red-50 flex items-center gap-1.5 border-t border-slate-100"
                                      >
                                        <span>🗑️</span> 폴더 삭제
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Left Bottom New Folder Creator */}
                    <div className="pt-3 border-t border-slate-150 mt-4 bg-slate-50 p-2.5 rounded-2xl">
                      <span className="text-[9px] font-black text-slate-450 block mb-1.5">📂 새 폴더 만들기</span>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="새 폴더 이름"
                          value={newExplorerFolderInput}
                          onChange={(e) => setNewExplorerFolderInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const trimmed = newExplorerFolderInput.trim();
                              if (trimmed) {
                                if (archiveTab === 'personal') {
                                  if (personalFolders.includes(trimmed)) {
                                    triggerToast('⚠️ 이미 지정된 명칭의 폴더입니다.');
                                  } else {
                                    setPersonalFolders(prev => [...prev, trimmed]);
                                    setNewExplorerFolderInput('');
                                    triggerToast(`📂 개인용 초안수하함 [${trimmed}]가 창설 등재되었습니다.`);
                                    setAuditLogs(prev => [
                                      {
                                        id: `log-${Date.now()}`,
                                        timestamp: new Date().toLocaleTimeString('ko-KR', { hourCycle: 'h23' }),
                                        action: '개인폴더 신설',
                                        details: `보관함 작업 과정 중 교사가 [${trimmed}] 폴더를 추가 개소하였습니다.`,
                                        isTeacher: true
                                      },
                                      ...prev
                                    ]);
                                  }
                                } else {
                                  if (sharedFolders.includes(trimmed)) {
                                    triggerToast('⚠️ 이미 존재하여 중복되는 폴더 분류명입니다.');
                                  } else {
                                    setSharedFolders(prev => [...prev, trimmed]);
                                    setNewExplorerFolderInput('');
                                    triggerToast(`🌐 표준 공용 폴더 [${trimmed}]가 신설 수납 승인되었습니다.`);
                                    setAuditLogs(prev => [
                                      {
                                        id: `log-${Date.now()}`,
                                        timestamp: new Date().toLocaleTimeString('ko-KR', { hourCycle: 'h23' }),
                                        action: '공용폴더 신설',
                                        details: `지식 통합 과정 중 교사에 가해 공용 [${trimmed}] 폴더가 추가 편성되었습니다.`,
                                        isTeacher: true
                                      },
                                      ...prev
                                    ]);
                                  }
                                }
                              }
                            }
                          }}
                          className="flex-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-[10.5px] font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#FF6B6B]"
                        />
                        <button
                          onClick={() => {
                            const trimmed = newExplorerFolderInput.trim();
                            if (trimmed) {
                              if (archiveTab === 'personal') {
                                if (personalFolders.includes(trimmed)) {
                                  triggerToast('⚠️ 이미 지정된 명칭의 폴더입니다.');
                                } else {
                                  setPersonalFolders(prev => [...prev, trimmed]);
                                  setNewExplorerFolderInput('');
                                  triggerToast(`📂 개인용 초안수하함 [${trimmed}]가 창설 등재되었습니다.`);
                                }
                              } else {
                                if (sharedFolders.includes(trimmed)) {
                                  triggerToast('⚠️ 이미 존재하여 중복되는 폴더 분류명입니다.');
                                } else {
                                  setSharedFolders(prev => [...prev, trimmed]);
                                  setNewExplorerFolderInput('');
                                  triggerToast(`🌐 표준 공용 폴더 [${trimmed}]가 신설 수납 승인되었습니다.`);
                                }
                              }
                            }
                          }}
                          className="px-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black cursor-pointer transition-colors"
                        >
                          만들기
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: Breadcrumbs, Global Search, and Filtered Docs Grid (2/3 Width) */}
                  <div className="md:col-span-2 p-5 flex flex-col overflow-y-auto bg-slate-50 space-y-4">
                    
                    {/* Top Functional Header: Search Input & Breadcrumbs display */}
                    <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                      
                      {/* Search Bar Input */}
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="문서 제목, 교안 본안 키워드, 내용 상세 검색..."
                          value={explorerSearch}
                          onChange={(e) => setExplorerSearch(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#FF6B6B] bg-slate-50 placeholder-slate-400"
                        />
                        {explorerSearch && (
                          <button
                            onClick={() => setExplorerSearch('')}
                            className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-650 font-bold"
                          >
                            지우기
                          </button>
                        )}
                      </div>


                    </div>

                    {/* Documents List Output Area */}
                    <div className="flex-1 overflow-y-auto pr-1">
                      {explorerSearch.trim() !== '' ? (
                        /* ==============================================================
                           INTEGRATED SEARCH MODE: Unified results across both archives
                           ============================================================== */
                        (() => {
                          const q = explorerSearch.trim().toLowerCase();
                          
                          const unifiedPersonal = savedUserPrompts.map(p => ({ ...p, source: 'personal' as const }));
                          const unifiedShared = sharedRepositoryPrompts.map(p => ({ ...p, source: 'shared' as const }));
                          const combinedPool = [...unifiedPersonal, ...unifiedShared];
                          
                          const filtered = combinedPool.filter(p => {
                            return (
                              p.title.toLowerCase().includes(q) ||
                              (p.description || '').toLowerCase().includes(q) ||
                              (p.promptText || '').toLowerCase().includes(q)
                            );
                          });

                          if (filtered.length === 0) {
                            return (
                              <div className="p-12 text-center text-slate-450 space-y-2 pt-20 bg-white rounded-2xl border border-dashed border-slate-200" key="empty-pocket">
                                <HelpCircle className="w-8 h-8 text-slate-300 mx-auto" />
                                <p className="text-xs font-black w-full text-center">보관된 프롬프트가 없습니다.</p>
                                <p className="text-[10px] text-slate-405 leading-relaxed">검색어를 변경하거나, 캔버스에서 새로운 프롬프트를 저장해 보세요.</p>
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-4" key="integrated-container">
                              <div className="text-[10px] bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl border border-slate-200 font-extrabold flex justify-between items-center">
                                <span>🔍 통합 검색 결과: 총 {filtered.length}건</span>
                                <button
                                  onClick={() => setExplorerSearch('')}
                                  className="text-[9px] underline text-slate-500 font-bold cursor-pointer"
                                >
                                  검색 초기화
                                </button>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pb-4" key="integrated-grid">
                                {filtered.map(p => {
                                  if (p.source === 'personal') {
                                    return (
                                      <div
                                        key={p.id}
                                        className="bg-slate-50 rounded-2xl p-4 border border-slate-200 hover:border-[#FF6B6B] transition-all relative group flex flex-col justify-between hover:shadow-sm overflow-hidden"
                                      >
                                        <div>
                                          <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[9px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200 font-bold">
                                              내 보관함
                                            </span>
                                            <button
                                              onClick={() => removeFromDrawerMyPocket(p.id)}
                                              className="text-slate-400 hover:text-rose-500 text-xs font-bold cursor-pointer transition-colors"
                                            >
                                              삭제
                                            </button>
                                          </div>
                                          <h4 className="text-xs font-black text-[#001C3D] mb-1.5 flex items-center gap-1">
                                            <span>📄</span> {p.title}
                                          </h4>
                                          <p className="text-[11px] text-slate-500 leading-normal line-clamp-2">
                                            {p.description}
                                          </p>
                                          <span className="block text-[10px] text-slate-400 font-semibold mt-1">
                                            📁 폴더: {p.category || '미분류'}
                                          </span>
                                        </div>

                                        <div className="mt-4 pt-3 border-t border-slate-200/50 flex flex-col gap-2">
                                          <button
                                            onClick={() => {
                                              selectTemplateAndGoToCanvas(p);
                                              setIsSavedDrawerOpen(false);
                                            }}
                                            className="w-full bg-[#FF6B6B] hover:bg-[#fa5353] text-[10px] text-white py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer text-center"
                                          >
                                            <Check className="w-3.5 h-3.5" />
                                            템플릿 선택
                                          </button>
                                          
                                          <div className="w-full grid grid-cols-2 gap-2">
                                            <button
                                              onClick={(e) => copyAndOpenExternalAI(p.promptText, e)}
                                              className="w-full bg-white hover:bg-slate-100 text-slate-700 hover:text-[#001C3D] text-[10px] py-1.5 rounded-lg border border-slate-250 font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                                            >
                                              <Copy className="w-3.5 h-3.5" />
                                              복사
                                            </button>

                                            <button
                                              onClick={() => {
                                                setMovingPromptId(p.id);
                                                setMoveTargetDestination('personal');
                                                setMoveTargetFolder(p.category || '미분류');
                                              }}
                                              className="w-full bg-white hover:bg-slate-100 text-slate-700 hover:text-[#001C3D] text-[10px] py-1.5 rounded-lg border border-slate-250 font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                                            >
                                              <FolderInput className="w-3.5 h-3.5 text-slate-500" />
                                              이동
                                            </button>
                                          </div>
                                        </div>

                                        {/* Inline Folder Selector Modal Overlay */}
                                        {movingPromptId === p.id && (
                                          <div className="absolute inset-0 bg-slate-900/95 rounded-2xl p-4 flex flex-col justify-between z-10 text-white animate-fade-in">
                                            <div className="space-y-1 overflow-y-auto max-h-[75%] pr-1">
                                              <span className="text-[10px] font-black uppercase text-[#FF6B6B] tracking-widest block flex items-center gap-1">
                                                📂 폴더 이동 설정
                                              </span>
                                              <p className="text-[11px] text-slate-200 line-clamp-1 font-bold">📄 {p.title}</p>
                                              
                                              <label className="block text-[9px] font-bold text-slate-400 mt-1">이동할 대상 보관함:</label>
                                              <select
                                                value={moveTargetDestination}
                                                onChange={(e) => {
                                                  const nextDest = e.target.value as 'personal' | 'shared';
                                                  setMoveTargetDestination(nextDest);
                                                  setMoveTargetFolder('미분류');
                                                }}
                                                className="w-full text-[11px] bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-[#FF6B6B]"
                                              >
                                                <option value="personal">📂 내 보관함</option>
                                                <option value="shared">🌐 우리 원 문서함</option>
                                              </select>

                                              <label className="block text-[9px] font-bold text-slate-400 mt-1">이동할 대상 폴더 선택:</label>
                                              <select
                                                value={moveTargetFolder}
                                                onChange={(e) => setMoveTargetFolder(e.target.value)}
                                                className="w-full text-[11px] bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-[#FF6B6B]"
                                              >
                                                {(moveTargetDestination === 'personal' ? personalFolders : sharedFolders).map(f => (
                                                  <option key={f} value={f}>{f}</option>
                                                ))}
                                              </select>
                                            </div>
                                            <div className="flex gap-2 mt-2">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (moveTargetDestination === 'personal') {
                                                    setSavedUserPrompts(prev => prev.map(item => item.id === p.id ? { ...item, category: moveTargetFolder } : item));
                                                  } else {
                                                    setSavedUserPrompts(prev => prev.filter(item => item.id !== p.id));
                                                    const newSharedItem = {
                                                      id: `shared-migrated-${Date.now()}`,
                                                      title: p.title.startsWith('🌟') ? p.title : `🌟 [우수사례] ${p.title}`,
                                                      category: moveTargetFolder,
                                                      description: p.description || '내 보관함에서 이식된 프롬프트입니다.',
                                                      promptText: p.promptText,
                                                      type: '우수 사례' as const,
                                                      author: '전소은 교사',
                                                      downloads: 0,
                                                      sharedDate: new Date().toISOString().split('T')[0],
                                                      status: '분류됨' as const,
                                                      isPinned: false
                                                    };
                                                    setSharedRepositoryPrompts(prev => [newSharedItem, ...prev]);
                                                  }
                                                  triggerToast('선택하신 보관함으로 문서가 이동되었습니다.');
                                                  setMovingPromptId(null);
                                                }}
                                                className="flex-1 bg-[#FF6B6B] hover:bg-[#fa5353] text-white text-[10px] font-bold py-1.5 rounded-lg transition-colors cursor-pointer"
                                              >
                                                이동 완료
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setMovingPromptId(null);
                                                }}
                                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-bold py-1.5 rounded-lg transition-colors cursor-pointer"
                                              >
                                                취소
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  } else {
                                    // p.source === 'shared'
                                    return (
                                      <div
                                        key={p.id}
                                        className="bg-blue-50/30 rounded-2xl p-4 border border-blue-100 hover:border-blue-300 transition-all relative flex flex-col justify-between hover:shadow-sm overflow-hidden"
                                      >
                                        <div>
                                          <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[9px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200 font-bold">
                                              우리 원 보관함
                                            </span>
                                            {p.isPinned ? (
                                              <span className="text-[9px] px-2.5 py-0.5 rounded-full font-black bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-0.5">
                                                ⭐ 공식 서식 (Official)
                                              </span>
                                            ) : (
                                              <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-black border ${
                                                p.type === '공식 서식'
                                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                              }`}>
                                                {p.type}
                                              </span>
                                            )}
                                          </div>
                                          <h4 className="text-xs font-black text-[#001C3D] mb-1.5 flex items-center gap-1">
                                            <span>🌍</span> {p.title}
                                          </h4>
                                          <p className="text-[11px] text-slate-500 leading-normal line-clamp-2">
                                            {p.description}
                                          </p>
                                          <span className="block text-[10px] text-slate-400 font-bold mt-2">
                                            ✍️ 저자/안배: {p.author}
                                          </span>
                                        </div>

                                        <div className="mt-4 pt-3 border-t border-slate-200/50 flex flex-col gap-2">
                                          <button
                                            onClick={() => {
                                              selectTemplateAndGoToCanvas({
                                                id: p.id,
                                                title: p.title,
                                                category: p.category as any,
                                                description: p.description,
                                                promptText: p.promptText,
                                                satisfaction: 97,
                                                runs: 100,
                                                tags: ['교직공유'],
                                                efficiency: 95,
                                                isHidden: false,
                                                createdAt: '2026-06-18'
                                              });
                                              setIsSavedDrawerOpen(false);
                                            }}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-[10px] text-white py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                                          >
                                            <Check className="w-3.5 h-3.5" />
                                            이 공유 템플릿 연동 조립
                                          </button>
                                          
                                          <div className="grid grid-cols-3 gap-1.5">
                                            <button
                                              onClick={(e) => copyAndOpenExternalAI(p.promptText, e)}
                                              className="bg-white hover:bg-slate-100 text-slate-700 text-[10px] py-1.5 rounded-lg border border-slate-250 font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                                            >
                                              <Copy className="w-3.5 h-3.5" />
                                              복사
                                            </button>

                                            <button
                                              onClick={() => {
                                                setMovingPromptId(p.id);
                                                setMoveTargetDestination('shared');
                                                setMoveTargetFolder(p.category || '미분류');
                                              }}
                                              className="bg-white hover:bg-slate-100 text-slate-700 text-[10px] py-1.5 rounded-lg border border-slate-250 font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                                            >
                                              <FolderInput className="w-3 h-3 text-slate-500" />
                                              이동
                                            </button>
                                            
                                            <button
                                              onClick={() => {
                                                const alreadyInMyDrafts = savedUserPrompts.some(item => item.title === p.title);
                                                if (alreadyInMyDrafts) {
                                                  triggerToast('💡 이미 내 작업실 공간에 수납 보관되어 있습니다.');
                                                  return;
                                                }
                                                setSavedUserPrompts(prev => [
                                                  ...prev,
                                                  {
                                                    id: `converted-${p.id}`,
                                                    title: p.title.replace('🍀 ', '').replace('🌟 [교사 공유] ', '').replace('🌟 [우수사례] ', ''),
                                                    category: p.category as any,
                                                    description: p.description,
                                                    promptText: p.promptText,
                                                    satisfaction: 95,
                                                    runs: 12,
                                                    tags: ['원문이식'],
                                                    efficiency: 90,
                                                    isHidden: false,
                                                    createdAt: '2026-06-18'
                                                  }
                                                ]);
                                                triggerToast('📥 [우리 원 보관함]의 지식이 내 작업실로 이식 수납되었습니다!');
                                              }}
                                              className="bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-[10px] py-1.5 rounded-lg border border-slate-200 font-extrabold transition-all flex items-center justify-center gap-1 cursor-pointer"
                                              title="내 보관함으로 복사 내려받기"
                                            >
                                              <span>수납</span>
                                            </button>
                                          </div>
                                        </div>

                                        {/* Inline Folder Selector Modal Overlay */}
                                        {movingPromptId === p.id && (
                                          <div className="absolute inset-0 bg-slate-900/95 rounded-2xl p-4 flex flex-col justify-between z-10 text-white animate-fade-in">
                                            <div className="space-y-1 overflow-y-auto max-h-[75%] pr-1">
                                              <span className="text-[10px] font-black uppercase text-purple-400 tracking-widest block flex items-center gap-1">
                                                📂 폴더 이동 설정
                                              </span>
                                              <p className="text-[11px] text-slate-200 line-clamp-1 font-bold">📄 {p.title}</p>
                                              
                                              <label className="block text-[9px] font-bold text-slate-400 mt-1">이동할 대상 보관함:</label>
                                              <select
                                                value={moveTargetDestination}
                                                onChange={(e) => {
                                                  const nextDest = e.target.value as 'personal' | 'shared';
                                                  setMoveTargetDestination(nextDest);
                                                  setMoveTargetFolder('미분류');
                                                }}
                                                className="w-full text-[11px] bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-[#FF6B6B]"
                                              >
                                                <option value="personal">📂 내 보관함</option>
                                                <option value="shared">🌐 우리 원 문서함</option>
                                              </select>

                                              <label className="block text-[9px] font-bold text-slate-400 mt-1">이동할 대상 폴더 선택:</label>
                                              <select
                                                value={moveTargetFolder}
                                                onChange={(e) => setMoveTargetFolder(e.target.value)}
                                                className="w-full text-[11px] bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-[#FF6B6B]"
                                              >
                                                {(moveTargetDestination === 'personal' ? personalFolders : sharedFolders).map(f => (
                                                  <option key={f} value={f}>{f}</option>
                                                ))}
                                              </select>
                                            </div>
                                            <div className="flex gap-2 mt-2">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (moveTargetDestination === 'shared') {
                                                    setSharedRepositoryPrompts(prev => prev.map(item => item.id === p.id ? { ...item, category: moveTargetFolder } : item));
                                                  } else {
                                                    setSharedRepositoryPrompts(prev => prev.filter(item => item.id !== p.id));
                                                    const newSavedItem = {
                                                      id: `personal-migrated-${Date.now()}`,
                                                      title: p.title.replace('🍀 ', '').replace('🌟 [교사 공유] ', '').replace('🌟 [우수사례] ', '').replace('🌟 ', ''),
                                                      category: moveTargetFolder,
                                                      mainCategory: '반운영',
                                                      description: p.description || '우리 원 보관함에서 이식된 프롬프트입니다.',
                                                      promptText: p.promptText,
                                                      canvasTemplate: p.promptText,
                                                      tags: ['이식됨'],
                                                      runs: 1,
                                                      satisfaction: 99,
                                                      efficiency: 100,
                                                      isHidden: false,
                                                      createdAt: new Date().toISOString().split('T')[0]
                                                    };
                                                    setSavedUserPrompts(prev => [newSavedItem, ...prev]);
                                                  }
                                                  triggerToast('선택하신 보관함으로 문서가 이동되었습니다.');
                                                  setMovingPromptId(null);
                                                }}
                                                className="flex-1 bg-purple-500 hover:bg-purple-600 text-white text-[10px] font-bold py-1.5 rounded-lg transition-colors cursor-pointer"
                                              >
                                                이동 완료
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setMovingPromptId(null);
                                                }}
                                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-bold py-1.5 rounded-lg transition-colors cursor-pointer"
                                              >
                                                취소
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  }
                                })}
                              </div>
                            </div>
                          );
                        })()
                      ) : archiveTab === 'personal' ? (
                        /* Case A: Personal Documents Grid */
                        (() => {
                          const filtered = savedUserPrompts
                            .filter(p => activeCabinetFolderFilter === '전체' ? true : p.category === activeCabinetFolderFilter)
                            .filter(p => {
                              if (!explorerSearch) return true;
                              const q = explorerSearch.toLowerCase();
                              return p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.promptText.toLowerCase().includes(q);
                            });

                          if (filtered.length === 0) {
                            return (
                              <div className="p-12 text-center text-slate-450 space-y-2 pt-20 bg-white rounded-2xl border border-dashed border-slate-200" key="empty-pocket">
                                <HelpCircle className="w-8 h-8 text-slate-300 mx-auto" />
                                <p className="text-xs font-black w-full text-center">보관된 프롬프트가 없습니다.</p>
                                <p className="text-[10px] text-slate-405 leading-relaxed">검색어를 변경하거나, 캔버스에서 새로운 프롬프트를 저장해 보세요.</p>
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-4" key="personal-container">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pb-4" key="personal-grid">
                                {filtered.map(p => (
                                  <div
                                    key={p.id}
                                    draggable
                                    onDragStart={(e) => {
                                      setIsDraggingCard(true);
                                      e.dataTransfer.setData('text/plain', p.id);
                                    }}
                                    onDragEnd={() => setIsDraggingCard(false)}
                                    className="bg-slate-50 rounded-2xl p-4 border border-slate-200 hover:border-[#FF6B6B] transition-all relative group flex flex-col justify-between cursor-grab active:cursor-grabbing hover:shadow-sm overflow-hidden"
                                  >
                                    <div>
                                      <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[9px] bg-white text-slate-550 px-2 py-0.5 rounded-full border border-slate-200 font-bold">
                                          내 보관함
                                        </span>
                                        <button
                                          onClick={() => removeFromDrawerMyPocket(p.id)}
                                          className="text-slate-400 hover:text-rose-500 text-xs font-bold cursor-pointer transition-colors"
                                        >
                                          삭제
                                        </button>
                                      </div>
                                      <h4 className="text-xs font-black text-[#001C3D] mb-1.5 flex items-center gap-1">
                                        <span>📄</span> {p.title}
                                      </h4>
                                      <p className="text-[11px] text-slate-500 leading-normal line-clamp-2">
                                        {p.description}
                                      </p>
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-slate-200/50 flex flex-col gap-2">
                                      <button
                                        onClick={() => {
                                          selectTemplateAndGoToCanvas(p);
                                          setIsSavedDrawerOpen(false);
                                        }}
                                        className="w-full bg-[#FF6B6B] hover:bg-[#fa5353] text-[10px] text-white py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer text-center"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        템플릿 선택
                                      </button>
                                      
                                      <div className="w-full grid grid-cols-2 gap-2">
                                        <button
                                          onClick={(e) => copyAndOpenExternalAI(p.promptText, e)}
                                          className="w-full bg-white hover:bg-slate-100 text-slate-700 hover:text-[#001C3D] text-[10px] py-1.5 rounded-lg border border-slate-250 font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                                        >
                                          <Copy className="w-3.5 h-3.5" />
                                          복사
                                        </button>

                                        <button
                                          onClick={() => {
                                            setMovingPromptId(p.id);
                                            setMoveTargetDestination('personal');
                                            setMoveTargetFolder(p.category || '미분류');
                                          }}
                                          className="w-full bg-white hover:bg-slate-100 text-slate-700 hover:text-[#001C3D] text-[10px] py-1.5 rounded-lg border border-slate-250 font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                                        >
                                          <FolderInput className="w-3.5 h-3.5 text-slate-500" />
                                          이동
                                        </button>
                                      </div>
                                    </div>

                                    {/* Inline Folder Selector Modal Overlay */}
                                    {movingPromptId === p.id && (
                                      <div className="absolute inset-0 bg-slate-900/95 rounded-2xl p-4 flex flex-col justify-between z-10 text-white animate-fade-in">
                                        <div className="space-y-1 overflow-y-auto max-h-[75%] pr-1">
                                          <span className="text-[10px] font-black uppercase text-[#FF6B6B] tracking-widest block flex items-center gap-1">
                                            📂 폴더 이동 설정
                                          </span>
                                          <p className="text-[11px] text-slate-200 line-clamp-1 font-bold">📄 {p.title}</p>
                                          
                                          <label className="block text-[9px] font-bold text-slate-400 mt-1">이동할 대상 보관함:</label>
                                          <select
                                            value={moveTargetDestination}
                                            onChange={(e) => {
                                              const nextDest = e.target.value as 'personal' | 'shared';
                                              setMoveTargetDestination(nextDest);
                                              setMoveTargetFolder('미분류');
                                            }}
                                            className="w-full text-[11px] bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-[#FF6B6B]"
                                          >
                                            <option value="personal">📂 내 보관함</option>
                                            <option value="shared">🌐 우리 원 문서함</option>
                                          </select>

                                          <label className="block text-[9px] font-bold text-slate-400 mt-1">이동할 대상 폴더 선택:</label>
                                          <select
                                            value={moveTargetFolder}
                                            onChange={(e) => setMoveTargetFolder(e.target.value)}
                                            className="w-full text-[11px] bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-[#FF6B6B]"
                                          >
                                            {(moveTargetDestination === 'personal' ? personalFolders : sharedFolders).map(f => (
                                              <option key={f} value={f}>{f}</option>
                                            ))}
                                          </select>
                                        </div>
                                        <div className="flex gap-2 mt-2">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (moveTargetDestination === 'personal') {
                                                setSavedUserPrompts(prev => prev.map(item => item.id === p.id ? { ...item, category: moveTargetFolder } : item));
                                              } else {
                                                setSavedUserPrompts(prev => prev.filter(item => item.id !== p.id));
                                                const newSharedItem = {
                                                  id: `shared-migrated-${Date.now()}`,
                                                  title: p.title.startsWith('🌟') ? p.title : `🌟 [우수사례] ${p.title}`,
                                                  category: moveTargetFolder,
                                                  description: p.description || '내 보관함에서 이식된 프롬프트입니다.',
                                                  promptText: p.promptText,
                                                  type: '우수 사례' as const,
                                                  author: '전소은 교사',
                                                  downloads: 0,
                                                  sharedDate: new Date().toISOString().split('T')[0],
                                                  status: '분류됨' as const,
                                                  isPinned: false
                                                };
                                                setSharedRepositoryPrompts(prev => [newSharedItem, ...prev]);
                                              }
                                              triggerToast('선택하신 보관함으로 문서가 이동되었습니다.');
                                              setMovingPromptId(null);
                                            }}
                                            className="flex-1 bg-[#FF6B6B] hover:bg-[#fa5353] text-white text-[10px] font-bold py-1.5 rounded-lg transition-colors cursor-pointer"
                                          >
                                            이동 완료
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setMovingPromptId(null);
                                            }}
                                            className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-bold py-1.5 rounded-lg transition-colors cursor-pointer"
                                          >
                                            취소
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {/* Glow Drop Target Zone while dragging */}
                              {isDraggingCard && (
                                <div
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    const cardId = e.dataTransfer.getData('text/plain');
                                    const targetCard = savedUserPrompts.find(item => item.id === cardId);
                                    if (targetCard) {
                                      promoteToSharedRepository(targetCard, e.clientX, e.clientY);
                                    }
                                    setIsDraggingCard(false);
                                  }}
                                  className="border-2 border-dashed border-blue-400 bg-blue-50/85 p-6 rounded-2xl text-center text-blue-600 font-black animate-pulse flex flex-col items-center justify-center gap-2 duration-300 transition-all cursor-crosshair min-h-[110px]"
                                >
                                  <Globe className="w-7 h-7 text-blue-500 animate-spin" />
                                  <span className="text-[11px]">여기에 마우스 드롭하여 공용 문서함 공유!</span>
                                </div>
                              )}
                            </div>
                          );
                        })()


                  ) : (
                    /* --- B. SHARED REPOSITORY (우리 원 문서함) --- */
                    sharedRepositoryPrompts.filter(item => sharedFilter === '전체' ? true : item.type === sharedFilter).length === 0 ? (
                      <div className="p-8 text-center text-slate-400 space-y-2 pt-20">
                        <Globe className="w-10 h-10 text-slate-200 mx-auto" />
                        <p className="text-sm font-bold">공유 정보가 존재하지 않습니다.</p>
                        <p className="text-xs text-slate-400">현재 조건에 해당하는 우수 사례가 유실 상태입니다.</p>
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] bg-blue-50 text-blue-750 px-2 py-0.5 rounded-md font-bold">
                            공용 아카이브
                          </span>
                        </div>

                        {activeCabinetFolderFilter !== '전체' && (
                          <div className="text-[10px] bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl border border-indigo-100 font-extrabold flex justify-between items-center">
                            <span>📂 정규 필터 활성화: [{activeCabinetFolderFilter}] 폴더</span>
                            <button
                              onClick={() => setActiveCabinetFolderFilter('전체')}
                              className="text-[9px] underline text-slate-500 font-bold"
                            >
                              필터 해제
                            </button>
                          </div>
                        )}

                        {sharedRepositoryPrompts
                          .filter(item => sharedFilter === '전체' ? true : item.type === sharedFilter)
                          .filter(p => activeCabinetFolderFilter === '전체' ? true : p.category === activeCabinetFolderFilter).length === 0 && (
                          <div className="p-8 text-center bg-slate-50 border border-slate-200/60 rounded-2xl text-slate-450 text-xs">
                            <span className="text-xl">🌐</span>
                            <p className="font-bold mt-1.5">이 공용 폴더에 분류 안배된 문서가 없습니다.</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">상기 분류 엔진 혹은 마이 드래프트를 통해 지식을 편제해 보세요.</p>
                          </div>
                        )}

                        {sharedRepositoryPrompts
                          .filter(item => sharedFilter === '전체' ? true : item.type === sharedFilter)
                          .filter(p => activeCabinetFolderFilter === '전체' ? true : p.category === activeCabinetFolderFilter)
                          .map(p => (
                            <div
                              key={p.id}
                              className="bg-blue-50/30 rounded-2xl p-4 border border-blue-100 hover:border-blue-300 transition-all relative flex flex-col justify-between hover:shadow-sm"
                            >
                              <div>
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[9px] bg-white text-slate-500 px-2 py-0.5 rounded-full border border-slate-200 font-bold">
                                    {p.category}
                                  </span>
                                  {p.isPinned ? (
                                    <span className="text-[9px] px-2.5 py-0.5 rounded-full font-black bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-0.5">
                                      ⭐ 공식 서식 (Official)
                                    </span>
                                  ) : (
                                    <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-black border ${
                                      p.type === '공식 서식'
                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    }`}>
                                      {p.type}
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-xs font-black text-[#001C3D] mb-1.5 flex items-center gap-1">
                                  <span>🌍</span> {p.title}
                                </h4>
                                <p className="text-[11px] text-slate-500 leading-normal line-clamp-2">
                                  {p.description}
                                </p>
                                <span className="block text-[10px] text-slate-400 font-bold mt-2">
                                  ✍️ 저자/안배: {p.author}
                                </span>
                              </div>

                              <div className="mt-4 pt-3 border-t border-slate-200/50 flex flex-col gap-2">
                                <button
                                  onClick={() => {
                                    // Assemble to main canvas format
                                    selectTemplateAndGoToCanvas({
                                      id: p.id,
                                      title: p.title,
                                      category: p.category as any,
                                      description: p.description,
                                      promptText: p.promptText,
                                      satisfaction: 97,
                                      runs: 100,
                                      tags: ['교직공유'],
                                      efficiency: 95,
                                      isHidden: false,
                                      createdAt: '2026-06-18'
                                    });
                                    setIsSavedDrawerOpen(false);
                                  }}
                                  className="w-full bg-blue-600 hover:bg-blue-700 text-[10px] text-white py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  이 공유 템플릿 연동 조립
                                </button>
                                
                                <div className="grid grid-cols-3 gap-1.5">
                                  <button
                                    onClick={(e) => copyAndOpenExternalAI(p.promptText, e)}
                                    className="bg-white hover:bg-slate-100 text-slate-700 text-[10px] py-1.5 rounded-lg border border-slate-250 font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    <Copy className="w-3 h-3" />
                                    복사
                                  </button>

                                  <button
                                    onClick={() => {
                                      setMovingPromptId(p.id);
                                      setMoveTargetDestination('shared');
                                      setMoveTargetFolder(p.category || '미분류');
                                    }}
                                    className="bg-white hover:bg-slate-100 text-slate-700 text-[10px] py-1.5 rounded-lg border border-slate-250 font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    <FolderInput className="w-3 h-3 text-slate-500" />
                                    이동
                                  </button>
                                  
                                  {/* Bidirectional Download to Personal Workspace */}
                                  <button
                                    onClick={() => {
                                      const alreadyInMyDrafts = savedUserPrompts.some(item => item.title === p.title);
                                      if (alreadyInMyDrafts) {
                                        triggerToast('💡 이미 내 작업실 공간에 수납 보관되어 있습니다.');
                                        return;
                                      }
                                      setSavedUserPrompts(prev => [
                                        ...prev,
                                        {
                                          id: `converted-${p.id}`,
                                          title: p.title.replace('🍀 ', '').replace('🌟 [교사 공유] ', '').replace('🌟 [우수사례] ', ''),
                                          category: p.category as any,
                                          description: p.description,
                                          promptText: p.promptText,
                                          satisfaction: 95,
                                          runs: 12,
                                          tags: ['원문이식'],
                                          efficiency: 90,
                                          isHidden: false,
                                          createdAt: '2026-06-18'
                                        }
                                      ]);
                                      triggerToast('📥 [우리 원 보관함]의 지식이 내 작업실로 이식 수납되었습니다!');
                                    }}
                                    className="bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-[10px] py-1.5 rounded-lg border border-slate-200 font-extrabold transition-all flex items-center justify-center gap-1 cursor-pointer"
                                    title="내 보관함으로 복사 내려받기"
                                  >
                                    <span>수납</span>
                                  </button>
                                </div>
                              </div>

                              {/* Inline Folder Selector Modal Overlay */}
                              {movingPromptId === p.id && (
                                <div className="absolute inset-0 bg-slate-900/95 rounded-2xl p-4 flex flex-col justify-between z-10 text-white animate-fade-in">
                                  <div className="space-y-1 overflow-y-auto max-h-[75%] pr-1">
                                    <span className="text-[10px] font-black uppercase text-purple-400 tracking-widest block flex items-center gap-1">
                                      📂 폴더 이동 설정
                                    </span>
                                    <p className="text-[11px] text-slate-200 line-clamp-1 font-bold">📄 {p.title}</p>
                                    
                                    <label className="block text-[9px] font-bold text-slate-400 mt-1">이동할 대상 보관함:</label>
                                    <select
                                      value={moveTargetDestination}
                                      onChange={(e) => {
                                        const nextDest = e.target.value as 'personal' | 'shared';
                                        setMoveTargetDestination(nextDest);
                                        setMoveTargetFolder('미분류');
                                      }}
                                      className="w-full text-[11px] bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-[#FF6B6B]"
                                    >
                                      <option value="personal">📂 내 보관함</option>
                                      <option value="shared">🌐 우리 원 문서함</option>
                                    </select>

                                    <label className="block text-[9px] font-bold text-slate-400 mt-1">이동할 대상 폴더 선택:</label>
                                    <select
                                      value={moveTargetFolder}
                                      onChange={(e) => setMoveTargetFolder(e.target.value)}
                                      className="w-full text-[11px] bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-[#FF6B6B]"
                                    >
                                      {(moveTargetDestination === 'personal' ? personalFolders : sharedFolders).map(f => (
                                        <option key={f} value={f}>{f}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="flex gap-2 mt-2">
                                    <button
                                      onClick={() => {
                                        if (moveTargetDestination === 'shared') {
                                          setSharedRepositoryPrompts(prev => prev.map(item => item.id === p.id ? { ...item, category: moveTargetFolder } : item));
                                        } else {
                                          setSharedRepositoryPrompts(prev => prev.filter(item => item.id !== p.id));
                                          const newSavedItem = {
                                            id: `personal-migrated-${Date.now()}`,
                                            title: p.title.replace('🍀 ', '').replace('🌟 [교사 공유] ', '').replace('🌟 [우수사례] ', '').replace('🌟 ', ''),
                                            category: moveTargetFolder,
                                            mainCategory: '반운영',
                                            description: p.description || '우리 원 보관함에서 이식된 프롬프트입니다.',
                                            promptText: p.promptText,
                                            canvasTemplate: p.promptText,
                                            tags: ['이식됨'],
                                            runs: 1,
                                            satisfaction: 99,
                                            efficiency: 100,
                                            isHidden: false,
                                            createdAt: new Date().toISOString().split('T')[0]
                                          };
                                          setSavedUserPrompts(prev => [newSavedItem, ...prev]);
                                        }
                                        triggerToast('선택하신 보관함으로 문서가 이동되었습니다.');
                                        setMovingPromptId(null);
                                      }}
                                      className="flex-1 bg-purple-500 hover:bg-purple-600 text-white text-[10px] font-bold py-1.5 rounded-lg transition-colors cursor-pointer"
                                    >
                                      이동 완료
                                    </button>
                                    <button
                                      onClick={() => {
                                        setMovingPromptId(null);
                                      }}
                                      className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-bold py-1.5 rounded-lg transition-colors cursor-pointer"
                                    >
                                      취소
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>


          </motion.div>
        </div>
      </div>
    )}
  </AnimatePresence>

      {/* ==============================================================
          D. ADMIN NEW PROMPT MODAL WINDOW (새 프롬프트 추가 / 수정)
          ============================================================== */}
      <AnimatePresence>
        {isNewPromptModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNewPromptModalOpen(false)}
              className="fixed inset-0 bg-slate-900"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-2xl w-full z-10 border border-slate-200"
            >
              {/* Head */}
              <div className="bg-[#001C3D] text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FFD93D] animate-ping"></div>
                  <h3 className="sys-heading-sub font-sans">
                    {editingPrompt ? '[프롬프트 수정] CMS 레코드 편집' : '[새 프롬프트 추가] CMS 레코드 생성'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsNewPromptModalOpen(false)}
                  className="p-1 px-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Input Container */}
              <form onSubmit={saveAdminPrompt} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                    프롬프트 템플릿 타이틀명 *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="예 : 만 3세 봄나들이 놀이 체험 유도문"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-navy"
                  />
                </div>

                {/* 2-Depth Category Row */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Field 1 (Left): 대분류 선택 (Main Category) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                      대분류 선택 (Main Category) *
                    </label>
                    <select
                      value={formMainCategory}
                      onChange={e => {
                        setFormMainCategory(e.target.value);
                        setFormSubCategory('');
                      }}
                      className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#FF6B6B] focus:border-[#FF6B6B] transition-all"
                    >
                      <option value="" disabled>대분류 선택...</option>
                      <option value="원운영">원운영</option>
                      <option value="반운영">반운영</option>
                      <option value="관찰/평가">관찰/평가</option>
                      <option value="기타">기타</option>
                      <option value="지원자료">지원자료</option>
                    </select>
                  </div>

                  {/* Field 2 (Right): 하위 카테고리 지정 (Sub Category) - Creatable Select */}
                  <div className="relative">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">
                        하위 카테고리 지정 (Sub Category) *
                      </label>
                      {formMainCategory && (
                        <button
                          type="button"
                          onClick={() => setIsSubManagerOpen(true)}
                          className="text-[10.5px] text-rose-500 hover:text-rose-600 font-black flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Sliders className="w-3 h-3" />
                          [+ 옵션 추가/관리]
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="카테고리 선택 또는 직접 입력..."
                        value={formSubCategory}
                        onChange={e => {
                          setFormSubCategory(e.target.value);
                          setIsSubComboOpen(true);
                        }}
                        onFocus={() => setIsSubComboOpen(true)}
                        className="w-full px-3.5 py-2.5 pr-9 font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#FF6B6B] focus:border-[#FF6B6B] transition-all text-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() => setIsSubComboOpen(!isSubComboOpen)}
                        className="absolute right-2.5 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>

                      {/* Dropdown Options */}
                      {isSubComboOpen && (
                        <>
                          {/* Invisible Click-outside overlay */}
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setIsSubComboOpen(false)}
                          />

                          <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto z-20 divide-y divide-slate-100 animate-slideDown">
                            {/* Filter options based on Main category */}
                            {(() => {
                              const sourceList = formMainCategory ? subCategoriesMap[formMainCategory] || [] : Object.values(subCategoriesMap).flat();
                              const filtered = sourceList.filter(opt => 
                                opt.toLowerCase().includes(formSubCategory.toLowerCase())
                              );

                              return (
                                <>
                                  {filtered.length > 0 ? (
                                    filtered.map(opt => (
                                      <button
                                        type="button"
                                        key={opt}
                                        onClick={() => {
                                          setFormSubCategory(opt);
                                          setIsSubComboOpen(false);
                                        }}
                                        className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer"
                                      >
                                        <span>{opt}</span>
                                        {formSubCategory === opt && (
                                          <span className="text-[#FF6B6B] text-[10px] font-bold">선택됨</span>
                                        )}
                                      </button>
                                    ))
                                  ) : (
                                    <div className="px-3.5 py-2.5 text-xs text-slate-400 italic">
                                      검색된 카테고리가 없습니다
                                    </div>
                                  )}

                                  {/* Active hover type-add state with a blue action row at the bottom */}
                                  {formSubCategory.trim() && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const trimmed = formSubCategory.trim();
                                        if (formMainCategory) {
                                          const prevList = subCategoriesMap[formMainCategory] || [];
                                          if (!prevList.includes(trimmed)) {
                                            const updated = [...prevList, trimmed];
                                            updateSubCategoriesMap({
                                              ...subCategoriesMap,
                                              [formMainCategory]: updated
                                            });
                                          }
                                        }
                                        setFormSubCategory(trimmed);
                                        setIsSubComboOpen(false);
                                        triggerToast(`➕ '${trimmed}' 카테고리가 새로 추가되었습니다.`);
                                      }}
                                      className="w-full text-left px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 transition-colors flex items-center justify-between cursor-pointer border-t border-blue-100 font-extrabold text-xs"
                                    >
                                      <span>[➕ '{formSubCategory}' 새 카테고리로 추가하기]</span>
                                      <span className="text-[10px] bg-blue-200/50 text-[#0052cc] font-black px-1.5 py-0.5 rounded-md">Add New</span>
                                    </button>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tags Row */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                    태그 입력 (쉼표 구분)
                  </label>
                  <input
                    type="text"
                    placeholder="만3세, 봄나들이, 학부모밀착"
                    value={formTags}
                    onChange={e => setFormTags(e.target.value)}
                    className="w-full px-3.5 py-2.5 font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#FF6B6B] focus:border-[#FF6B6B] text-slate-700 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                    한 줄 요약 설명문 (어시스턴트 카드에 표기)
                  </label>
                  <input
                    type="text"
                    placeholder="가정 소통과 아동 안전 안내를 위해 설계된 고효율 부모 밀착 템플릿입니다."
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none"
                  />
                </div>

                {/* Input A: System Guidance */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                    [입력창 A] AI 시스템 지시문 (System Guidance)
                  </label>
                  <p className="text-[10px] text-slate-400 mb-1.5 leading-normal">
                    💡 교사에게 노출되지 않고 백그라운드에서 AI에게 전달할 시스템 역할 정의(System Role) 및 서식 지침을 기입하세요.
                  </p>
                  <textarea
                    rows={3}
                    value={formSystemGuidance}
                    onChange={e => setFormSystemGuidance(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#FF6B6B] font-mono leading-relaxed resize-none text-[11px] text-slate-700 bg-slate-50/50"
                    placeholder="예: 너는 만 3세 발달과업과 누리과정을 연동하는 15년 차 베테랑 유아 교육 전문가야. 학부모 소통용이므로 전문적이되 신뢰감 가득하며 부드러운 교사 말투로 서술형 답안을 출력해야 해."
                  />
                </div>

                {/* Input B: Canvas Template */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                    [입력창 B] 교사용 캔버스 템플릿 (Canvas Template) *
                  </label>
                  <p className="text-[10px] text-slate-400 mb-1.5 leading-normal">
                    💡 교사가 실제로 직접 보며 작성(스마트 슬롯) 및 수정을 완수할 메인 본문 템플릿을 기입하세요. <strong className="text-emerald-500 font-black">중괄호 &#123;&#123;변수명:기본값&#125;&#125; 형식</strong>을 기입하면 교사용 화면에 자동 슬롯 단추가 생성됩니다!
                  </p>
                  <textarea
                    required
                    rows={4}
                    value={formCanvasTemplate}
                    onChange={e => setFormCanvasTemplate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#FF6B6B] font-mono leading-relaxed resize-none text-[11.5px] text-slate-800"
                    placeholder="예: 우리 햇살반 어린이들이 이번 주에는 신나는 {{활동명:흙 놀이}} 활동을 만끽했습니다. 처음에는 {{체험내용:흙을 낯설어하는 유아}}도 있었으나, 이내 {{긍정변화:친구들과 기뻐하며 뒹굴며}} 무척 즐거워했습니다."
                  />
                </div>

                {/* Footer buttons */}
                <div className="flex items-center justify-end gap-3.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsNewPromptModalOpen(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-250 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    작업 취소
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-[#FF6B6B] hover:bg-[#fa5353] text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    저장 및 빌드 배포
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==============================================================
          E. SEND GIFT MODAL WINDOW WITH LIVE SEED (선물 보내기)
          ============================================================== */}
      <AnimatePresence>
        {isGiftModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsGiftModalOpen(false)}
              className="fixed inset-0 bg-slate-900"
            />

            {/* Content card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-md w-full relative z-10 border border-slate-250"
            >
              <div className="bg-[#001C3D] text-white px-5 py-4 flex items-center justify-between">
                <span className="font-extrabold text-[#8EF6D6] text-xs font-mono uppercase tracking-widest">[선물 보내기] 격려 물품 청약</span>
                <button onClick={() => setIsGiftModalOpen(false)} className="text-slate-300 hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={submitGift} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">지정 지급 기수교사</label>
                  <input
                    type="text"
                    disabled
                    value={teachers.find(t => t.id === selectedTeacherId)?.name || ''}
                    className="w-full bg-slate-50 px-3 py-2 text-xs text-slate-500 rounded-lg font-bold border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">증여 카테고리 및 선물 품번 *</label>
                  <select
                    value={giftForm.prize}
                    onChange={e => setGiftForm({ ...giftForm, prize: e.target.value })}
                    className="w-full bg-white px-3 py-2 text-xs border border-slate-200 rounded-xl font-bold text-slate-700"
                  >
                    <option value="🎁 스타벅스 아이스 아메리카노">🎁 스타벅스 아메리카노 커넥팅 커피 쿠폰</option>
                    <option value="🎁 배달의민족 1만원 꿀적 적립 쿠폰">🎁 배달의민족 1만원 디지털 모바일 기프티콘</option>
                    <option value="🎁 투썸플레이스 부드러운 케이크 조각">🎁 투썸플레이스 스트로베리 초콜릿 생크림</option>
                    <option value="🎁 교촌치킨 허니오리지널 세트">🎁 교촌치킨 허니오리지널 고효율 수령권</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">상담 및 선물 사유 메일 전송 본문</label>
                  <input
                    type="text"
                    required
                    value={giftForm.title}
                    onChange={e => setGiftForm({ ...giftForm, title: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                    placeholder="예 : 에듀테크 수업 참여 감사선물 증여"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 text-xs font-bold border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsGiftModalOpen(false)}
                    className="px-3.5 py-1.5 bg-slate-100 rounded-lg text-slate-600 hover:bg-slate-200 cursor-pointer"
                  >
                    의사 취소
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-[#FF6B6B] hover:bg-[#fa5353] text-white flex items-center gap-1 cursor-pointer"
                  >
                    <Gift className="w-3.5 h-3.5" />
                    [선물 발송 확정]
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==============================================================
          F. SEND COLLATIVE STICKER WINDOW WITH LEVEL EMBLEMS (칭찬 스티커 발송)
          ============================================================== */}
      <AnimatePresence>
        {isStickerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsStickerModalOpen(false)}
              className="fixed inset-0 bg-slate-900"
            />

            {/* Content card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-md w-full relative z-10 border border-slate-250"
            >
              <div className="bg-[#001C3D] text-white px-5 py-4 flex items-center justify-between">
                <span className="font-extrabold text-[#FFD93D] text-xs font-mono uppercase tracking-widest">[칭찬 스티커 및 대표 뱃지 임명]</span>
                <button onClick={() => setIsStickerModalOpen(false)} className="text-slate-300 hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={submitSticker} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">수여 지표 교사</label>
                  <input
                    type="text"
                    disabled
                    value={teachers.find(t => t.id === selectedTeacherId)?.name || ''}
                    className="w-full bg-slate-50 px-3 py-2 text-xs text-slate-500 rounded-lg font-bold border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">수여할 뱃지 칭호 등급 선택 *</label>
                  <select
                    value={stickerForm.sticker}
                    onChange={e => setStickerForm({ ...stickerForm, sticker: e.target.value })}
                    className="w-full bg-white px-3 py-2 text-xs border border-slate-200 rounded-xl font-bold text-slate-700"
                  >
                    <option value="⭐ 에듀테크 마스터">⭐ [에듀테크 마스터] - 최고 기술 리더</option>
                    <option value="⭐ 소통왕 선임교사">⭐ [소통왕 선임교사] - 학부모 밀착 소통왕</option>
                    <option value="⭐ 창의활동 개척자">⭐ [창의활동 개척자] - 자연 미술 교육 개척자</option>
                    <option value="⭐ 동료교사 등대">⭐ [동료교사 등대] - 신임 교사 든든한 멘토</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">스티커 임명식 공식 안내 한 줄 코멘트</label>
                  <input
                    type="text"
                    required
                    value={stickerForm.comment}
                    onChange={e => setStickerForm({ ...stickerForm, comment: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 text-xs font-bold border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsStickerModalOpen(false)}
                    className="px-3.5 py-1.5 bg-slate-100 rounded-lg text-slate-600 hover:bg-slate-200 cursor-pointer"
                  >
                    의향 취소
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-[#001C3D] hover:bg-[#002D5E] text-white flex items-center gap-1 cursor-pointer"
                  >
                    <Smile className="w-3.5 h-3.5 text-yellow-300" />
                    [칭찬 수여 발송 확정]
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==============================================================
          G. SAVE DESTINATION MODAL WINDOW (메가 프롬프트 저장)
          ============================================================== */}
      <AnimatePresence>
        {isSaveModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSaveModalOpen(false)}
              className="fixed inset-0 bg-slate-900"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-lg w-full z-10 border border-slate-200"
            >
              {/* Head */}
              <div className="bg-[#001C3D] text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FF6B6B] animate-ping"></div>
                  <h3 className="sys-heading-sub font-sans flex items-center gap-1.5">
                    <Save className="w-4 h-4 text-emerald-400" /> 보관함 저장
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSaveModalOpen(false)}
                  className="p-1 px-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Input Container */}
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    문서 타이틀 제목 컨펌 및 수정
                  </label>
                  <input
                    type="text"
                    required
                    value={saveDocTitle}
                    onChange={(e) => setSaveDocTitle(e.target.value)}
                    placeholder="저장할 교안/알림장 제목을 작성하세요."
                    className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-none focus:border-[#FF6B6B] focus:ring-1 focus:ring-[#FF6B6B] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">
                    저장소 목적지 선택
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Option 1: 개인 내 보관함 */}
                    <button
                      type="button"
                      onClick={() => {
                        setSaveDestination('personal');
                        setSelectedFolder('미분류');
                        setIsCreatingNewFolder(false);
                        setNewFolderName('');
                      }}
                      className={`p-4 rounded-2xl border text-left transition-all flex flex-col gap-1.5 cursor-pointer ${
                        saveDestination === 'personal'
                          ? 'border-[#FF6B6B] bg-rose-50/20 shadow-md ring-1 ring-[#FF6B6B]'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Folder className="w-4 h-4 text-[#FFB6B6]" />
                        <span className="text-xs font-extrabold text-slate-800">📂 내 보관함</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-normal leading-normal">
                        나만 볼 수 있는 임시 초안 보관 드로어에 격리식으로 안전하게 수납합니다.
                      </span>
                    </button>

                    {/* Option 2: 우리 원 문서함 */}
                    <button
                      type="button"
                      onClick={() => {
                        setSaveDestination('shared');
                        setSelectedFolder('미분류');
                        setIsCreatingNewFolder(false);
                        setNewFolderName('');
                      }}
                      className={`p-4 rounded-2xl border text-left transition-all flex flex-col gap-1.5 cursor-pointer ${
                        saveDestination === 'shared'
                          ? 'border-purple-500 bg-purple-50/20 shadow-md ring-1 ring-purple-500'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Globe className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-extrabold text-slate-800">🌐 우리 원 문서함</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-normal leading-normal">
                        어린이집 소속 동료 교사 전원과 우수 교지 자산으로 실시간 동기화하여 공유합니다.
                      </span>
                    </button>
                  </div>
                </div>

                {/* --- 폴더 분류 (Folder Organization) --- */}
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">
                      📂 폴더 분류 (Folder Organization)
                    </label>
                    {!isCreatingNewFolder && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingNewFolder(true);
                          setNewFolderName('');
                        }}
                        className="text-[10px] font-extrabold text-[#FF6B6B] hover:text-rose-600 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Plus className="w-3 h-3" /> [+ 새 폴더 만들기]
                      </button>
                    )}
                  </div>

                  {isCreatingNewFolder ? (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white border border-rose-200 rounded-xl p-3 space-y-2.5 shadow-sm"
                    >
                      <div className="text-[10px] font-black text-[#FF6B6B] flex items-center gap-1">
                        ✨ 새 {saveDestination === 'personal' ? '개인 보관' : '우리 원'} 폴더 이름 지정
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          placeholder="새 폴더 이름을 입력하세요"
                          className="flex-1 text-xs font-semibold border border-slate-200 bg-slate-50/30 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-[#FF6B6B] focus:ring-1 focus:ring-[#FF6B6B]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const trimmed = newFolderName.trim();
                            if (!trimmed) {
                              triggerToast('⚠️ 폴더 이름을 입력해 주세요.');
                              return;
                            }
                            if (saveDestination === 'personal') {
                              if (personalFolders.includes(trimmed)) {
                                triggerToast('⚠️ 이미 존재하는 폴더 이름입니다.');
                                return;
                              }
                              setPersonalFolders(prev => [...prev, trimmed]);
                              setSelectedFolder(trimmed);
                              triggerToast(`📂 새 개인 보관 폴더 [${trimmed}]가 신설되었습니다.`);
                            } else {
                              if (sharedFolders.includes(trimmed)) {
                                triggerToast('⚠️ 이미 존재하는 폴더 이름입니다.');
                                return;
                              }
                              setSharedFolders(prev => [...prev, trimmed]);
                              setSelectedFolder(trimmed);
                              triggerToast(`🌐 새 원 문서공유 폴더 [${trimmed}]가 신설되었습니다.`);
                            }
                            setIsCreatingNewFolder(false);
                            setNewFolderName('');
                          }}
                          className="bg-[#FF6B6B] hover:bg-rose-600 text-[10.5px] text-white font-black px-3.5 py-1.5 rounded-xl cursor-pointer transition-all"
                        >
                          만들기
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingNewFolder(false);
                            setNewFolderName('');
                          }}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-500 text-[10.5px] font-bold px-3 py-1.5 rounded-xl cursor-pointer transition-all"
                        >
                          취소
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                      {(saveDestination === 'personal' ? personalFolders : sharedFolders).map(folder => {
                        const isEdited = editingFolder?.type === saveDestination && editingFolder?.name === folder;
                        const isLocked = lockedFolders[folder];
                        const showMenu = activeMenuFolder?.type === saveDestination && activeMenuFolder?.name === folder;

                        return (
                          <div
                            key={folder}
                            onClick={() => {
                              if (!isEdited) {
                                setSelectedFolder(folder);
                              }
                            }}
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                              selectedFolder === folder
                                ? saveDestination === 'personal'
                                  ? 'bg-rose-50/70 border-rose-200 text-rose-700'
                                  : 'bg-indigo-50/70 border-indigo-200 text-indigo-700'
                                : 'bg-white border-slate-200 text-slate-755 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex-1 flex items-center gap-2">
                              <span>{isLocked ? '🔒' : '📁'}</span>
                              {isEdited ? (
                                <input
                                  type="text"
                                  autoFocus
                                  value={editingFolderNameValue}
                                  onChange={(e) => setEditingFolderNameValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      renameFolder(saveDestination, folder, editingFolderNameValue);
                                      setEditingFolder(null);
                                    } else if (e.key === 'Escape') {
                                      setEditingFolder(null);
                                    }
                                  }}
                                  onBlur={() => {
                                    renameFolder(saveDestination, folder, editingFolderNameValue);
                                    setEditingFolder(null);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="border border-[#FF6B6B] bg-white text-xs px-2 py-1 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF6B6B] font-bold text-slate-800"
                                />
                              ) : (
                                <span className={selectedFolder === folder ? 'font-black' : ''}>
                                  {folder} {folder === '미분류' && '(기본값)'}
                                </span>
                              )}
                            </div>

                            {/* Options Button / Context Menu [⋮] */}
                            {!isEdited && (
                              <div className="relative flex items-center" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (activeMenuFolder?.name === folder && activeMenuFolder?.type === saveDestination) {
                                      setActiveMenuFolder(null);
                                    } else {
                                      setActiveMenuFolder({ type: saveDestination, name: folder });
                                    }
                                  }}
                                  className="p-1 rounded-lg hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 transition-colors"
                                >
                                  <MoreVertical className="w-3.5 h-3.5 text-slate-500" />
                                </button>

                                {showMenu && (
                                  <div className="absolute right-0 top-6 bg-white border border-slate-250 rounded-xl shadow-lg py-1 min-w-[120px] z-50 text-left">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (isLocked && !isAdminMode) {
                                          triggerToast('🔒 이 폴더는 관리자에 의해 표준 서식으로 보호 지정(Locked)되어 변경이 차단되었습니다.');
                                        } else {
                                          setEditingFolder({ type: saveDestination, name: folder });
                                          setEditingFolderNameValue(folder);
                                        }
                                        setActiveMenuFolder(null);
                                      }}
                                      className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-slate-705 hover:bg-slate-50 flex items-center gap-1.5"
                                    >
                                      <span>✏️</span> 이름 변경
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (folder === '미분류') {
                                          triggerToast('⚠️ [미분류] 기본 폴더는 삭제할 수 없습니다.');
                                          return;
                                        }
                                        if (isLocked && !isAdminMode) {
                                          triggerToast('🔒 이 폴더는 표준 서식 보안으로 잠매되어 삭제 행위가 금지되었습니다.');
                                          return;
                                        }
                                        deleteFolder(saveDestination, folder);
                                        setActiveMenuFolder(null);
                                      }}
                                      className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-red-650 hover:bg-red-50 flex items-center gap-1.5 border-t border-slate-105"
                                    >
                                      <span>🗑️</span> 폴더 삭제
                                    </button>
                                    
                                    {isAdminMode && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          toggleFolderLock(folder);
                                          setActiveMenuFolder(null);
                                        }}
                                        className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-slate-705 hover:bg-slate-50 flex items-center gap-1.5 border-t border-slate-100"
                                      >
                                        <span>{isLocked ? '🔓' : '🔒'}</span>
                                        {isLocked ? '잠금 해제' : '공식 잠금'}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsSaveModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      if (!saveDocTitle.trim()) {
                        triggerToast('⚠️ 저장할 문서 제목을 입력해 주세요.');
                        return;
                      }

                      if (saveDestination === 'personal') {
                        const newSavedItem: PromptTemplate = {
                          id: `mega-saved-${Date.now()}`,
                          title: saveDocTitle,
                          category: selectedFolder,
                          mainCategory: selectedTemplate?.mainCategory || '반운영',
                          description: `${selectedTemplate?.description || ''} (조합 완성본)`,
                          promptText: assembledMegaPrompt,
                          tags: ['메가 프롬프트', ...((selectedTemplate?.tags) || [])],
                          runs: 1,
                          satisfaction: 99,
                          efficiency: 140,
                          isHidden: false,
                          createdAt: new Date().toISOString().split('T')[0]
                        };
                        setSavedUserPrompts(prev => [newSavedItem, ...prev]);
                        triggerToast(`💾 내 보관함의 [${selectedFolder}] 폴더에 수납 완료되었습니다!`);
                      } else {
                        const newSharedItem = {
                          id: `shared-mega-${Date.now()}`,
                          title: `🌟 [우수사례] ${saveDocTitle}`,
                          category: selectedFolder,
                          description: `${selectedTemplate?.description || ''} (조직 간 지식 공유 초안)`,
                          promptText: assembledMegaPrompt,
                          type: '우수 사례' as const,
                          author: '전소은 교사',
                          downloads: 0,
                          sharedDate: new Date().toISOString().split('T')[0],
                          status: '미분류' as const,
                          isPinned: false
                        };
                        setSharedRepositoryPrompts(prev => [newSharedItem, ...prev]);
                        triggerToast(`🌐 우리 원 문서함의 [${selectedFolder}] 폴더에 지식 공유 기여 완료되었습니다!`);
                      }
                      setIsSaveModalOpen(false);
                      triggerParticles(['💖', '✨', '⭐', '🎈', '💾'], e.clientX, e.clientY);
                    }}
                    className="px-5 py-2 text-xs font-extrabold text-white bg-gradient-to-r from-[#FF6B6B] to-rose-500 hover:from-rose-500 hover:to-rose-600 rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" /> 저장 완료
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==============================================================
          G-2. CANVAS SAVE DESTINATION MODAL WINDOW (프롬프트 캔버스 저장)
          ============================================================== */}
      <AnimatePresence>
        {isCanvasSaveModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCanvasSaveModalOpen(false)}
              className="fixed inset-0 bg-slate-900"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-lg w-full z-10 border border-slate-200"
            >
              {/* Head */}
              <div className="bg-[#001C3D] text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FF6B6B] animate-ping"></div>
                  <h3 className="sys-heading-sub font-sans flex items-center gap-1.5">
                    <Save className="w-4 h-4 text-emerald-400" /> 프롬프트 보관
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCanvasSaveModalOpen(false)}
                  className="p-1 px-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Input Container */}
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    프롬프트 제목 컨펌 및 수정
                  </label>
                  <input
                    type="text"
                    required
                    value={canvasSaveTitle}
                    onChange={(e) => setCanvasSaveTitle(e.target.value)}
                    placeholder="저장할 프롬프트 제목을 입력하세요."
                    className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-none focus:border-[#FF6B6B] focus:ring-1 focus:ring-[#FF6B6B] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">
                    저장소 목적지 선택
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Option 1: 개인 내 보관함 */}
                    <button
                      type="button"
                      onClick={() => {
                        setCanvasSaveDestination('personal');
                        setCanvasSaveSelectedFolder('미분류');
                        setIsCanvasSaveCreatingNewFolder(false);
                        setCanvasSaveNewFolderName('');
                      }}
                      className={`p-4 rounded-2xl border text-left transition-all flex flex-col gap-1.5 cursor-pointer ${
                        canvasSaveDestination === 'personal'
                          ? 'border-[#FF6B6B] bg-rose-50/20 shadow-md ring-1 ring-[#FF6B6B]'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Folder className="w-4 h-4 text-[#FFB6B6]" />
                        <span className="text-xs font-extrabold text-slate-800">📂 내 보관함</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-normal leading-normal">
                        나만 볼 수 있는 임시 초안 보관 드로어에 안전하게 수납합니다.
                      </span>
                    </button>

                    {/* Option 2: 우리 원 보관함 */}
                    <button
                      type="button"
                      onClick={() => {
                        setCanvasSaveDestination('shared');
                        setCanvasSaveSelectedFolder('미분류');
                        setIsCanvasSaveCreatingNewFolder(false);
                        setCanvasSaveNewFolderName('');
                      }}
                      className={`p-4 rounded-2xl border text-left transition-all flex flex-col gap-1.5 cursor-pointer ${
                        canvasSaveDestination === 'shared'
                          ? 'border-purple-500 bg-purple-50/20 shadow-md ring-1 ring-purple-500'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Globe className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-extrabold text-slate-800">🌐 우리 원 보관함</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-normal leading-normal">
                        어린이집 소속 동료 교사 전원과 우수 교지 자산으로 공유합니다.
                      </span>
                    </button>
                  </div>
                </div>

                {/* --- 폴더 분류 (Folder Organization) --- */}
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">
                      📂 폴더 분류 (Folder Organization)
                    </label>
                    {!isCanvasSaveCreatingNewFolder && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsCanvasSaveCreatingNewFolder(true);
                          setCanvasSaveNewFolderName('');
                        }}
                        className="text-[10px] font-extrabold text-[#FF6B6B] hover:text-rose-600 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Plus className="w-3 h-3" /> [+ 새 폴더 만들기]
                      </button>
                    )}
                  </div>

                  {isCanvasSaveCreatingNewFolder ? (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white border border-rose-200 rounded-xl p-3 space-y-2.5 shadow-sm"
                    >
                      <div className="text-[10px] font-black text-[#FF6B6B] flex items-center gap-1">
                        ✨ 새 {canvasSaveDestination === 'personal' ? '개인 보관' : '우리 원'} 폴더 이름 지정
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={canvasSaveNewFolderName}
                          onChange={(e) => setCanvasSaveNewFolderName(e.target.value)}
                          placeholder="새 폴더 이름을 입력하세요"
                          className="flex-1 text-xs font-semibold border border-slate-200 bg-slate-50/30 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-[#FF6B6B] focus:ring-1 focus:ring-[#FF6B6B]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const trimmed = canvasSaveNewFolderName.trim();
                            if (!trimmed) {
                              triggerToast('⚠️ 폴더 이름을 입력해 주세요.');
                              return;
                            }
                            if (canvasSaveDestination === 'personal') {
                              if (personalFolders.includes(trimmed)) {
                                triggerToast('⚠️ 이미 존재하는 폴더 이름입니다.');
                                  return;
                              }
                              setPersonalFolders(prev => [...prev, trimmed]);
                              setCanvasSaveSelectedFolder(trimmed);
                              triggerToast(`📂 새 개인 보관 폴더 [${trimmed}]가 신설되었습니다.`);
                            } else {
                              if (sharedFolders.includes(trimmed)) {
                                triggerToast('⚠️ 이미 존재하는 폴더 이름입니다.');
                                return;
                              }
                              setSharedFolders(prev => [...prev, trimmed]);
                              setCanvasSaveSelectedFolder(trimmed);
                              triggerToast(`🌐 새 원 문서공유 폴더 [${trimmed}]가 신설되었습니다.`);
                            }
                            setIsCanvasSaveCreatingNewFolder(false);
                            setCanvasSaveNewFolderName('');
                          }}
                          className="bg-[#FF6B6B] hover:bg-rose-600 text-[10.5px] text-white font-black px-3.5 py-1.5 rounded-xl cursor-pointer transition-all"
                        >
                          만들기
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCanvasSaveCreatingNewFolder(false);
                            setCanvasSaveNewFolderName('');
                          }}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-500 text-[10.5px] font-bold px-3 py-1.5 rounded-xl cursor-pointer transition-all"
                        >
                          취소
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                      {(canvasSaveDestination === 'personal' ? personalFolders : sharedFolders).map(folder => {
                        const isLocked = lockedFolders[folder];
                        return (
                          <div
                            key={folder}
                            onClick={() => {
                              setCanvasSaveSelectedFolder(folder);
                            }}
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                              canvasSaveSelectedFolder === folder
                                ? canvasSaveDestination === 'personal'
                                  ? 'bg-rose-50/70 border-rose-200 text-rose-700'
                                  : 'bg-indigo-50/70 border-indigo-200 text-indigo-700'
                                : 'bg-white border-slate-200 text-slate-755 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex-1 flex items-center gap-2">
                              <span>{isLocked ? '🔒' : '📁'}</span>
                              <span className={canvasSaveSelectedFolder === folder ? 'font-black' : ''}>
                                {folder} {folder === '미분류' && '(기본값)'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCanvasSaveModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      if (!canvasSaveTitle.trim()) {
                        triggerToast('⚠️ 저장할 프롬프트 제목을 입력해 주세요.');
                        return;
                      }

                      if (canvasSaveDestination === 'personal') {
                        const newSavedItem: PromptTemplate = {
                          id: `canvas-saved-${Date.now()}`,
                          title: canvasSaveTitle,
                          category: canvasSaveSelectedFolder,
                          mainCategory: selectedTemplate?.mainCategory || '반운영',
                          description: selectedTemplate?.description || '프롬프트 캔버스에서 직접 저장한 항목입니다.',
                          promptText: canvasText,
                          canvasTemplate: canvasText,
                          tags: selectedTemplate?.tags || [],
                          runs: 1,
                          satisfaction: 99,
                          efficiency: 100,
                          isHidden: false,
                          createdAt: new Date().toISOString().split('T')[0]
                        };
                        setSavedUserPrompts(prev => [newSavedItem, ...prev]);
                        triggerToast(`💾 내 보관함의 [${canvasSaveSelectedFolder}] 폴더에 성공적으로 수납 완료되었습니다!`);
                      } else {
                        const newSharedItem = {
                          id: `shared-canvas-${Date.now()}`,
                          title: `🌟 [우수사례] ${canvasSaveTitle}`,
                          category: canvasSaveSelectedFolder,
                          description: selectedTemplate?.description || '프롬프트 캔버스에서 직접 공유한 항목입니다.',
                          promptText: canvasText,
                          type: '우수 사례' as const,
                          author: '전소은 교사',
                          downloads: 0,
                          sharedDate: new Date().toISOString().split('T')[0],
                          status: '미분류' as const,
                          isPinned: false
                        };
                        setSharedRepositoryPrompts(prev => [newSharedItem, ...prev]);
                        triggerToast(`🌐 우리 원 보관함의 [${canvasSaveSelectedFolder}] 폴더에 지식 공유 기여 완료되었습니다!`);
                      }

                      setIsCanvasSaveModalOpen(false);
                      setCanvasSavedFeedback(true);
                      triggerParticles(['💖', '✨', '💾'], e.clientX, e.clientY);
                      setTimeout(() => {
                        setCanvasSavedFeedback(false);
                      }, 2500);
                    }}
                    className="px-5 py-2 text-xs font-extrabold text-white bg-gradient-to-r from-[#FF6B6B] to-rose-500 hover:from-rose-500 hover:to-rose-600 rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" /> 저장 완료
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==============================================================
          H. SOFT CONFIRMATION DIALOG MODAL (공식 폴더 변형 통제 보호)
          ============================================================== */}
      <AnimatePresence>
        {softConfirm?.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setSoftConfirm(null)}
              className="fixed inset-0 bg-[#001C3D]/80 backdrop-blur-xs"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-md w-full z-10 border border-amber-300"
            >
              {/* Alert Header */}
              <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-6 py-4 flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-white animate-bounce" />
                <h3 className="sys-heading-sub font-sans tracking-wide">
                  ⚠️ [경고] 원내 지식 표준 수납함 변형 통제
                </h3>
              </div>

              {/* Warnings details */}
              <div className="p-6 space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2 font-sans text-left">
                  <p className="text-[10px] font-black text-amber-905 uppercase">
                    ※ 보호 지정(Officially Protected) 표준 폴더 변경 감지
                  </p>
                  <p className="text-xs text-slate-700 font-bold leading-relaxed">
                    선택하신 <strong className="text-[#001C3D] bg-white px-1.5 py-0.5 rounded border border-slate-200">[{softConfirm.oldName}]</strong> 폴더는 
                    행정 관리실에 의해 지정된 <span className="text-amber-600 font-extrabold font-mono">공식 표준 폴더(★)</span>이자 잠정 보안 수하구조입니다.
                  </p>
                </div>

                <div className="text-xs text-slate-500 text-left leading-relaxed font-semibold space-y-1.5 font-sans">
                  {softConfirm.type === 'rename' ? (
                    <>
                      <p className="text-rose-600 font-black">● 이름 변경시 학년별 지식 정합성이 수동 손상될 우려가 존재합니다.</p>
                      <p>● 기존 배포 템플릿과의 싱크 동기화가 풀릴 수 있으며 개편 대화 이력이 파편화될 수 있습니다.</p>
                      <p className="text-slate-700 mt-2">새 명명안: <strong className="text-emerald-600">[{softConfirm.newName}]</strong></p>
                    </>
                  ) : (
                    <>
                      <p className="text-rose-600 font-black font-semibold">● 이 폴더를 삭제하면 저장되었던 다수의 우수 본안들이 [미분류]함으로 긴급 강제 피난 이송됩니다.</p>
                      <p>● 통폐합 없이 임의 철거할 시 원내 교사들의 협업 질서가 교란될 위험이 있습니다.</p>
                    </>
                  )}
                </div>

                <p className="text-xs font-black text-slate-800 text-center py-1">
                  정말로 강제로 동작을 추진하시겠습니까?
                </p>

                {/* Confirm/Cancel actions styling aligned to teacher canvas standard */}
                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setSoftConfirm(null)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                  >
                    아니오, 취소합니다
                  </button>
                  <button
                    type="button"
                    onClick={softConfirm.onConfirm}
                    className="flex-1 py-3 bg-[#FF6B6B] hover:bg-rose-600 text-white rounded-xl text-xs font-black transition-all cursor-pointer text-center shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                  >
                    예, 강제 진행합니다
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==============================================================
          I. PROGRESSIVE PROMPT DELETION CONFIRMATION MODAL (2nd Confirmation Modal)
          ============================================================== */}
      <AnimatePresence>
        {isDeleteConfirmModalOpen && promptToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsDeleteConfirmModalOpen(false);
                setPromptToDelete(null);
              }}
              className="fixed inset-0 bg-[#001C3D]/80 backdrop-blur-xs"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-md w-full z-15 border border-rose-300"
            >
              {/* Alert Header */}
              <div className="bg-gradient-to-r from-red-600 to-rose-600 text-white px-6 py-4 flex items-center gap-2.5">
                <Trash2 className="w-5 h-5 text-white animate-pulse" />
                <h3 className="sys-heading-sub font-sans tracking-wide">
                  ⚠️ [경고] 프롬프트 영구 제거 최종 확인
                </h3>
              </div>

              {/* Warnings details */}
              <div className="p-6 space-y-4">
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2 font-sans text-left">
                  <p className="text-[10px] font-black text-rose-900 uppercase">
                    ※ CMS DATASET DELETION WARNING
                  </p>
                  <p className="text-xs text-slate-700 font-bold leading-relaxed">
                    삭제 대상: <strong className="text-rose-700 bg-white px-1.5 py-0.5 rounded border border-rose-250">[{promptToDelete.title}]</strong>
                  </p>
                  <p className="text-[11px] text-slate-600 font-medium mt-1 leading-normal">
                    본 프롬프트는 CMS 원천 데이터 라이브러리에서 완전히 말소되며, 일선 현장의 모든 교사 클라이언트 환경에서 즉시 제거됩니다.
                  </p>
                </div>

                <div className="text-xs text-slate-500 text-left leading-relaxed font-semibold space-y-1.5 font-sans">
                  <p className="text-rose-600 font-black font-semibold">● 삭제 완료 시 기존 이력을 포함하여 복원이 원천 불가능합니다.</p>
                  <p>● 해당 템플릿과 연결된 모든 정량 지표 및 지식 채널이 완전 소멸 처리됩니다.</p>
                </div>

                <p className="text-xs font-black text-slate-800 text-center py-1">
                  정말로 해당 프롬프트를 영구 삭제하시겠습니까?
                </p>

                {/* Confirm/Cancel actions */}
                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDeleteConfirmModalOpen(false);
                      setPromptToDelete(null);
                    }}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                  >
                    대기, 보존합니다
                  </button>
                  <button
                    type="button"
                    onClick={confirmAdminDelete}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer text-center shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                  >
                    예, 영구 삭제합니다
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==============================================================
          J. SUB-CATEGORY DYNAMIC OPTION MANAGER MODAL (관리자용 하위 카테고리 CRUD)
          ============================================================== */}
      <AnimatePresence>
        {isSubManagerOpen && formMainCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsSubManagerOpen(false);
                setEditingSubIndex(null);
                setNewSubInput('');
              }}
              className="fixed inset-0 bg-[#001C3D]/80 backdrop-blur-xs"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-md w-full z-15 border border-slate-200"
            >
              {/* Header */}
              <div className="bg-[#001C3D] text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-rose-405" />
                  <h3 className="sys-heading-sub font-sans font-black text-white">
                    [{formMainCategory}] 하위 옵션 관리
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsSubManagerOpen(false);
                    setEditingSubIndex(null);
                    setNewSubInput('');
                  }}
                  className="p-1 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                {/* 1. Add form */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2">하위 카테고리 신규 추가</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSubInput}
                      onChange={e => setNewSubInput(e.target.value)}
                      placeholder="예: 영유아 관찰"
                      className="flex-1 px-3 py-2 text-xs font-bold bg-white rounded-xl border border-slate-200 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#FF6B6B]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const trimmed = newSubInput.trim();
                        if (!trimmed) {
                          triggerToast('⚠️ 추가할 카테고리 명칭을 입력해주세요.');
                          return;
                        }
                        const currentList = subCategoriesMap[formMainCategory] || [];
                        if (currentList.includes(trimmed)) {
                          triggerToast('⚠️ 이미 존재하는 하위 카테고리입니다.');
                          return;
                        }
                        const updatedList = [...currentList, trimmed];
                        updateSubCategoriesMap({
                          ...subCategoriesMap,
                          [formMainCategory]: updatedList
                        });
                        setNewSubInput('');
                        triggerToast(`➕ '${trimmed}' 카테고리가 등록되었습니다.`);
                      }}
                      className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-black text-xs rounded-xl cursor-pointer transition-colors"
                    >
                      추가
                    </button>
                  </div>
                </div>

                {/* 2. List of current Subs with edit/delete controls */}
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2">현재 서브 옵션 목록 ({ (subCategoriesMap[formMainCategory] || []).length })</p>
                  
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {(subCategoriesMap[formMainCategory] || []).length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center py-4">등록된 하위 카테고리가 없습니다.</p>
                    ) : (
                      (subCategoriesMap[formMainCategory] || []).map((sub, idx) => {
                        const isEditing = editingSubIndex === idx;

                        return (
                          <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/75 rounded-xl border border-slate-100/50 transition-colors">
                            {isEditing ? (
                              <div className="flex items-center gap-2 flex-1 mr-2">
                                <input
                                  type="text"
                                  value={editingSubValue}
                                  onChange={e => setEditingSubValue(e.target.value)}
                                  className="flex-1 px-2.5 py-1 text-xs font-bold bg-white rounded-lg border border-slate-300 text-slate-700"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const val = editingSubValue.trim();
                                    if (!val) {
                                      triggerToast('⚠️ 수정할 명칭을 입력해주세요.');
                                      return;
                                    }
                                    const currentList = [...(subCategoriesMap[formMainCategory] || [])];
                                    if (currentList.includes(val) && currentList[idx] !== val) {
                                      triggerToast('⚠️ 이미 존재하는 하위 카테고리 명칭입니다.');
                                      return;
                                    }
                                    const originalValue = currentList[idx];
                                    currentList[idx] = val;
                                    updateSubCategoriesMap({
                                      ...subCategoriesMap,
                                      [formMainCategory]: currentList
                                    });

                                    // If current form value was using this sub-category, update it!
                                    if (formSubCategory === originalValue) {
                                      setFormSubCategory(val);
                                    }
                                    
                                    setEditingSubIndex(null);
                                    triggerToast('✏️ 하위 카테고리 명칭이 변경되었습니다.');
                                  }}
                                  className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white font-bold text-[10px] rounded-lg cursor-pointer transition-colors"
                                >
                                  저장
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingSubIndex(null)}
                                  className="px-2.5 py-1 bg-slate-300 hover:bg-slate-400 text-slate-700 font-bold text-[10px] rounded-lg cursor-pointer transition-colors"
                                >
                                  취소
                                </button>
                              </div>
                            ) : (
                              <>
                                <span className="text-xs font-extrabold text-slate-700">#{sub}</span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingSubIndex(idx);
                                      setEditingSubValue(sub);
                                    }}
                                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-white cursor-pointer transition-colors"
                                    title="이름 수정"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const currentList = [...(subCategoriesMap[formMainCategory] || [])];
                                      const removedValue = currentList[idx];
                                      currentList.splice(idx, 1);
                                      updateSubCategoriesMap({
                                        ...subCategoriesMap,
                                        [formMainCategory]: currentList
                                      });

                                      // If current form value is deleted, reset it
                                      if (formSubCategory === removedValue) {
                                        setFormSubCategory('');
                                      }

                                      triggerToast(`🗑️ '${removedValue}' 하위 카테고리가 소멸 처리되었습니다.`);
                                    }}
                                    className="p-1 text-rose-450 hover:text-rose-600 rounded-md hover:bg-white cursor-pointer transition-colors"
                                    title="삭제"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-100 text-right flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold">이동식 팝업 관리기</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsSubManagerOpen(false);
                    setEditingSubIndex(null);
                    setNewSubInput('');
                  }}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs rounded-xl cursor-pointer transition-colors"
                >
                  닫기
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==============================================================
          K. SECRET DEVELOPER SYNC & BACKUP MODAL (Hidden Developer Center)
          ============================================================== */}
      <AnimatePresence>
        {showSyncModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSyncModal(false)}
              className="fixed inset-0 bg-[#001C3D]/80 backdrop-blur-xs animate-fade-in"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-2xl w-full z-15 border border-slate-200 relative my-8"
            >
              {/* Header */}
              <div className="bg-[#001C3D] text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-blue-400 animate-pulse" />
                  <h3 className="sys-heading-sub font-sans font-black text-white text-sm">
                    배포 사이트 동기화 & 백업 관리자 (Developer Center)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSyncModal(false)}
                  className="p-1 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto font-sans text-left">
                {/* Info Panel */}
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-2">
                  <h4 className="text-xs font-black text-blue-900 flex items-center gap-1.5">
                    <Cloud className="w-4 h-4" /> 실시간 코드베이스 연동 동기화 시스템
                  </h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    현재 브라우저에 저장되어 있는 템플릿 정보를 서버의 <code>src/custom_templates.ts</code> 파일에 영구 기록합니다. 
                    기록된 파일은 Git에 푸시하여 배포 시 반영되며, 최초 방문한 다른 PC의 브라우저에도 8개가 아닌 <strong>현재 구성하신 개수 ({prompts.length}개)</strong>의 템플릿이 완벽히 제공됩니다.
                  </p>
                </div>

                {/* Stats cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center border border-slate-100">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400">동기화 대기 중인 프롬프트 템플릿</p>
                      <p className="text-base font-black text-[#001C3D] mt-0.5">{prompts.length} 개</p>
                    </div>
                    <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold">텍스트 CMS</span>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center border border-slate-100">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400">동기화 대기 중인 디자인 템플릿</p>
                      <p className="text-base font-black text-[#001C3D] mt-0.5">{designPrompts.length} 개</p>
                    </div>
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">디자인 팩토리</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      fetch('/api/sync-to-codebase', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompts, designPrompts }),
                      })
                      .then(res => res.json())
                      .then(data => {
                        if (data.success) {
                          triggerToast('☁️ 코드베이스 즉시 강제 동기화가 성공적으로 완료되었습니다! Git에 커밋 후 푸시하시면 배포 사이트에 완벽히 적용됩니다.');
                        } else {
                          triggerToast('❌ 동기화 중 오류가 발생했습니다.');
                        }
                      })
                      .catch(() => triggerToast('❌ 서버 연결에 실패했습니다 (배포 사이트에서는 수동 JSON 백업을 권장합니다).'));
                    }}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex justify-center items-center gap-1.5 cursor-pointer"
                  >
                    <FolderSync className="w-4 h-4" />
                    <span>[서버 코드베이스 즉시 동기화 실행]</span>
                  </button>
                </div>

                {/* Manual Backup / Import Section */}
                <div className="border-t border-slate-150 pt-4 space-y-4">
                  <div>
                    <h4 className="text-xs font-black text-[#001C3D] flex items-center gap-2">
                      <Save className="w-4 h-4 text-slate-500" />
                      수동 템플릿 백업 & 일괄 이관 복원 (JSON Backup & Migrate)
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      브라우저 로컬 스토리지(LocalStorage)의 데이터를 수동 백업하거나 다른 PC/배포 사이트로 마이그레이션할 수 있습니다.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Export Block */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <h5 className="text-[10px] font-bold text-slate-700">1. 현재 템플릿 데이터 내보내기 (Export)</h5>
                        <button
                          type="button"
                          onClick={() => {
                            const exportData = JSON.stringify({ prompts, designPrompts }, null, 2);
                            navigator.clipboard.writeText(exportData);
                            triggerToast('📋 백업 데이터가 클립보드에 복사되었습니다!');
                          }}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[9px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-2.5 h-2.5" />
                          <span>복사</span>
                        </button>
                      </div>
                      <textarea
                        readOnly
                        value={JSON.stringify({ prompts, designPrompts }, null, 2)}
                        className="w-full h-32 p-2 bg-slate-50 border border-slate-200 rounded-xl text-[9px] font-mono text-slate-600 focus:outline-none"
                      />
                    </div>

                    {/* Import Block */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <h5 className="text-[10px] font-bold text-slate-700">2. 외부 백업 데이터 일괄 복원하기 (Import)</h5>
                      </div>
                      <textarea
                        placeholder="복사한 백업 JSON 데이터를 여기에 붙여넣으세요..."
                        id="modal-import-json-textarea"
                        className="w-full h-20 p-2 bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-[9px] font-mono text-slate-600 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const textarea = document.getElementById('modal-import-json-textarea') as HTMLTextAreaElement;
                          if (!textarea || !textarea.value.trim()) {
                            triggerToast('⚠️ 입력창에 유효한 백업 데이터를 먼저 입력하세요.');
                            return;
                          }
                          try {
                            const parsed = JSON.parse(textarea.value);
                            if (parsed.prompts && Array.isArray(parsed.prompts)) {
                              setPrompts(parsed.prompts);
                            }
                            if (parsed.designPrompts && Array.isArray(parsed.designPrompts)) {
                              setDesignPrompts(parsed.designPrompts);
                            }
                            triggerToast('🎉 템플릿 백업 데이터가 로컬 스토리지에 즉시 복원·적용되었습니다!');
                            textarea.value = '';
                            setShowSyncModal(false);
                          } catch (e) {
                            triggerToast('❌ 올바르지 않은 JSON 데이터 형식이거나 백업 구조에 오류가 있습니다.');
                          }
                        }}
                        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer shadow-sm flex justify-center items-center gap-1"
                      >
                        <Download className="w-3 h-3 text-blue-400" />
                        <span>[데이터로 로컬 스토리지 덮어쓰기 복원]</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 text-right flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold">비밀 관리자용 동기화 게이트</span>
                <button
                  type="button"
                  onClick={() => setShowSyncModal(false)}
                  className="px-5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs rounded-xl cursor-pointer transition-colors"
                >
                  닫기
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

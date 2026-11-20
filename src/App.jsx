import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
  addDoc,
} from 'firebase/firestore';
import {
  QrCode,
  Users,
  Play,
  RotateCcw,
  Copy,
  Check,
  Shuffle,
  Volume2,
  VolumeX,
  ArrowLeft,
  ArrowRight,
  UserPlus,
  Trash2,
  Sparkles,
  Trophy,
  Share2,
  Eye,
  ChevronRight,
  Sliders,
  AlertCircle,
  Crown,
  MessageCircleHeart,
  ExternalLink,
} from 'lucide-react';

// ==========================================
// 1. Firebase 초기화 및 환경 설정 (Strict Rules 준수)
// ==========================================
const firebaseConfig = {
  apiKey: 'AIzaSyCA9QN_QSQ3sjiLlMX1e6BZhizeTn6DhV8',
  authDomain: 'ssu-kr.firebaseapp.com',
  projectId: 'ssu-kr',
  storageBucket: 'ssu-kr.firebasestorage.app',
  messagingSenderId: '533076919110',
  appId: '1:533076919110:web:9b67e2dcbe88bdcc691b47',
  measurementId: 'G-5CBRP738V0',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'qr-ladder-game-v2';

// ==========================================
// 2. Web Audio API 합성 효과음 유틸리티
// ==========================================
class SoundFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.ctx = new AudioContext();
    }
  }

  playTick(pitch = 440) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        pitch * 1.2,
        this.ctx.currentTime + 0.06
      );
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        this.ctx.currentTime + 0.06
      );
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.07);
    } catch (e) {}
  }

  playPop() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        880,
        this.ctx.currentTime + 0.1
      );
      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.11);
    } catch (e) {}
  }

  playFanfare() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        const start = this.ctx.currentTime + idx * 0.09;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.12, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + 0.36);
      } catch (e) {}
    });
  }
}

const sfx = new SoundFX();

// ==========================================
// 3. 상수 및 사다리 알고리즘 헬퍼 함수
// ==========================================
const AVATARS = [
  '🐶',
  '🐱',
  '🦊',
  '🐻',
  '🐼',
  '🐨',
  '🐯',
  '🦁',
  '🐮',
  '🐷',
  '🐸',
  '🐵',
  '🦄',
  '🐝',
  '🐙',
  '🦖',
  '👻',
  '🤖',
  '👽',
  '👑',
];
const COLORS = [
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#10B981',
  '#06B6D4',
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#F43F5E',
  '#14B8A6',
  '#84CC16',
];

// 6자리 초대 코드 생성 (혼동 유발 문자 I, O, 0, 1 제외)
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 사다리 가로줄 생성기
function generateLadderRungs(playerCount, density = 'medium') {
  if (playerCount < 2) return [];
  const rungs = [];
  const rowsCount = density === 'low' ? 6 : density === 'high' ? 14 : 10;
  const minY = 0.08;
  const maxY = 0.92;
  const stepY = (maxY - minY) / rowsCount;

  for (let r = 0; r < rowsCount; r++) {
    const baseY = minY + r * stepY + stepY * 0.2;
    let c = 0;
    while (c < playerCount - 1) {
      const prob = density === 'low' ? 0.35 : density === 'high' ? 0.65 : 0.5;
      if (Math.random() < prob) {
        const jitterY = baseY + Math.random() * 0.4 * stepY;
        rungs.push({ col: c, y: Number(jitterY.toFixed(4)) });
        c += 2; // 인접 기둥에 동일 높이 중복 생성 방지
      } else {
        c += 1;
      }
    }
  }
  return rungs.sort((a, b) => a.y - b.y);
}

// 특정 출발 인덱스에서 사다리를 탔을 때의 경로 좌표 및 최종 도착 컬럼 계산
function traceLadderPath(startCol, playerCount, rungs) {
  let currentCol = startCol;
  let currentY = 0;
  const points = [{ col: currentCol, y: 0 }];
  const sortedRungs = [...rungs].sort((a, b) => a.y - b.y);

  for (const rung of sortedRungs) {
    if (rung.y <= currentY) continue;
    if (rung.col === currentCol) {
      points.push({ col: currentCol, y: rung.y });
      currentCol += 1;
      points.push({ col: currentCol, y: rung.y });
      currentY = rung.y;
    } else if (rung.col === currentCol - 1) {
      points.push({ col: currentCol, y: rung.y });
      currentCol -= 1;
      points.push({ col: currentCol, y: rung.y });
      currentY = rung.y;
    }
  }

  points.push({ col: currentCol, y: 1 });
  return { points, endCol: currentCol };
}

// ==========================================
// 4. 메인 애플리케이션 컴포넌트
// ==========================================
export default function App() {
  // Firebase 인증 상태
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  // 샌드박스/iframe 환경 감지 상태
  const [isInIframe, setIsInIframe] = useState(false);
  const [dismissIframeBanner, setDismissIframeBanner] = useState(false);

  // 네비게이션 및 실시간 방 상태
  const [view, setView] = useState('home'); // 'home' | 'room'
  const [roomCode, setRoomCode] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [players, setPlayers] = useState([]);
  const [reactions, setReactions] = useState([]);

  // 로컬 UI 상태
  const [toastMsg, setToastMsg] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [muted, setMuted] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedResult, setCopiedResult] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // 참가자 등록 폼 상태
  const [myName, setMyName] = useState('');
  const [myAvatar, setMyAvatar] = useState(AVATARS[0]);
  const [proxyName, setProxyName] = useState('');
  const [showProxyModal, setShowProxyModal] = useState(false);

  // 로컬 애니메이션 진행 상태 (Firestore의 activeTrace 이벤트에 동기화)
  const [localActiveIndex, setLocalActiveIndex] = useState(null);
  const [traceProgress, setTraceProgress] = useState(0);

  const animFrameRef = useRef(null);
  const lastProcessedTraceTsRef = useRef(0);
  const nicknameInputRef = useRef(null);

  // 알림 토스트 함수
  const showToast = (msg, type = 'info') => {
    setToastMsg({ msg, type });
    setTimeout(() => {
      setToastMsg((prev) => (prev?.msg === msg ? null : prev));
    }, 3200);
  };

  // 음소거 토글
  const toggleMute = () => {
    sfx.muted = !muted;
    setMuted(!muted);
  };

  // iframe/미리보기 실행 여부 감지
  useEffect(() => {
    try {
      if (window.self !== window.top) {
        setIsInIframe(true);
      }
    } catch (e) {
      setIsInIframe(true);
    }
  }, []);

  // ------------------------------------------
  // Effect 1: Firebase 익명/커스텀 토큰 인증 초기화 (RULE 3 준수)
  // ------------------------------------------
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (
          typeof __initial_auth_token !== 'undefined' &&
          __initial_auth_token
        ) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error('Firebase Auth error:', err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // URL ?room=XXXXXX 파라미터 감지 및 자동 방 입장
  useEffect(() => {
    if (!authReady || !user) return;
    const params = new URLSearchParams(window.location.search);
    const paramRoom = params.get('room');
    if (paramRoom && paramRoom.trim().length >= 4) {
      const cleanCode = paramRoom.trim().toUpperCase();
      setJoinInput(cleanCode);
      enterRoom(cleanCode, true);
    }
  }, [authReady, user]);

  // ------------------------------------------
  // Effect 2: Firestore 실시간 방, 참가자, 라이브 리액션 구독
  // ------------------------------------------
  useEffect(() => {
    if (!user || !roomCode || view !== 'room') return;

    // 1) 방 상태 문서 실시간 구독
    const roomRef = doc(
      db,
      'artifacts',
      appId,
      'public',
      'data',
      'ladder_rooms',
      roomCode
    );
    const unsubRoom = onSnapshot(
      roomRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setRoomData(data);

          // 대기실 복귀 시 로컬 애니메이션 상태 초기화
          if (data.status === 'lobby') {
            if (animFrameRef.current)
              cancelAnimationFrame(animFrameRef.current);
            setLocalActiveIndex(null);
            setTraceProgress(0);
            lastProcessedTraceTsRef.current = 0;
          }

          // 모든 연결된 기기에서 동일한 사다리 경로 추적 애니메이션 실행
          if (
            data.status === 'playing' &&
            data.activeTrace &&
            data.activeTrace.triggeredAt > lastProcessedTraceTsRef.current
          ) {
            lastProcessedTraceTsRef.current = data.activeTrace.triggeredAt;
            runSynchronizedAnimation(data.activeTrace.playerIndex);
          }
        } else {
          showToast('존재하지 않거나 종료된 방입니다.', 'error');
          setView('home');
          setRoomCode('');
        }
      },
      (err) => {
        console.error('Room snapshot error:', err);
      }
    );

    // 2) 참가자 컬렉션 실시간 구독 (RULE 2: orderBy 없이 전체 fetch 후 메모리 정렬)
    const playersCol = collection(
      db,
      'artifacts',
      appId,
      'public',
      'data',
      `ladder_players_${roomCode}`
    );
    const unsubPlayers = onSnapshot(
      playersCol,
      (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
        setPlayers(list);
      },
      (err) => {
        console.error('Players snapshot error:', err);
      }
    );

    // 3) 라이브 이모지 리액션 실시간 구독
    const reactionsCol = collection(
      db,
      'artifacts',
      appId,
      'public',
      'data',
      `ladder_reactions_${roomCode}`
    );
    const unsubReactions = onSnapshot(
      reactionsCol,
      (snap) => {
        const now = Date.now();
        const recent = [];
        snap.forEach((d) => {
          const item = { id: d.id, ...d.data() };
          if (now - (item.createdAt || 0) < 4200) {
            recent.push(item);
          }
        });
        setReactions(recent);
      },
      (err) => {
        console.error('Reactions snapshot error:', err);
      }
    );

    return () => {
      unsubRoom();
      unsubPlayers();
      unsubReactions();
    };
  }, [user, roomCode, view]);

  // ------------------------------------------
  // 호스트 권한 여부 및 참가자 수 변동 시 1~N 결과 칸 자동 동기화
  // ------------------------------------------
  const isHost = useMemo(() => {
    return Boolean(user && roomData && roomData.hostId === user.uid);
  }, [user, roomData]);

  useEffect(() => {
    if (!isHost || !roomData || roomData.status !== 'lobby') return;
    const count = players.length;
    const currentResults = roomData.results || [];

    if (currentResults.length !== count) {
      let nextResults = [...currentResults];
      if (count > currentResults.length) {
        const existingNums = new Set(nextResults.map((r) => r.rank));
        for (let i = currentResults.length; i < count; i++) {
          let nextNum = 1;
          while (existingNums.has(nextNum)) nextNum++;
          existingNums.add(nextNum);
          nextResults.push({
            id: `res_${Date.now()}_${i}`,
            rank: nextNum,
            label: '',
          });
        }
      } else {
        nextResults = nextResults.slice(0, count).map((item, idx) => ({
          ...item,
          rank: item.rank <= count ? item.rank : idx + 1,
        }));
      }

      const roomRef = doc(
        db,
        'artifacts',
        appId,
        'public',
        'data',
        'ladder_rooms',
        roomCode
      );
      updateDoc(roomRef, { results: nextResults }).catch(console.error);
    }
  }, [players.length, isHost, roomData?.status]);

  // ------------------------------------------
  // 방 생성 및 입장 핸들러
  // ------------------------------------------
  const handleCreateRoom = async () => {
    if (!user) return;
    setIsLoading(true);
    sfx.playPop();
    try {
      const code = generateRoomCode();
      const roomRef = doc(
        db,
        'artifacts',
        appId,
        'public',
        'data',
        'ladder_rooms',
        code
      );
      await setDoc(roomRef, {
        code,
        hostId: user.uid,
        status: 'lobby', // 'lobby' | 'playing' | 'finished'
        density: 'medium',
        results: [],
        rungs: [],
        revealedIndices: {},
        showAllPaths: false,
        activeTrace: null,
        createdAt: Date.now(),
      });

      const url = new URL(window.location.href);
      url.searchParams.set('room', code);
      window.history.replaceState({}, '', url.toString());

      setRoomCode(code);
      setView('room');
      showToast(
        `방(${code})이 개설되었습니다! QR 코드를 공유해 참가자를 모집하세요.`
      );
    } catch (err) {
      console.error(err);
      showToast('방 생성 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const enterRoom = async (targetCode, fromQrParam = false) => {
    if (!user) return;
    const code = (targetCode || joinInput).trim().toUpperCase();
    if (code.length < 4) {
      showToast('올바른 6자리 초대 코드를 입력해주세요.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const roomRef = doc(
        db,
        'artifacts',
        appId,
        'public',
        'data',
        'ladder_rooms',
        code
      );
      const snap = await getDoc(roomRef);
      if (!snap.exists()) {
        showToast('해당 코드의 방을 찾을 수 없습니다.', 'error');
        setIsLoading(false);
        return;
      }

      const url = new URL(window.location.href);
      url.searchParams.set('room', code);
      window.history.replaceState({}, '', url.toString());

      setRoomCode(code);
      setView('room');
      sfx.playPop();

      if (fromQrParam) {
        showToast(`방(${code})에 입장했습니다! 아래에 이름을 등록해주세요.`);
        setTimeout(() => {
          nicknameInputRef.current?.focus();
        }, 400);
      }
    } catch (err) {
      console.error(err);
      showToast('방 입장 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveRoom = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.toString());
    setView('home');
    setRoomCode('');
    setRoomData(null);
    setPlayers([]);
  };

  // ------------------------------------------
  // 참가자 등록 / 수정 / 삭제 핸들러
  // ------------------------------------------
  const myPlayerRecord = useMemo(() => {
    if (!user) return null;
    return players.find((p) => p.uid === user.uid && !p.isProxy);
  }, [players, user]);

  const handleJoinAsPlayer = async (e) => {
    e.preventDefault();
    if (!user || !roomCode) return;
    const trimmed = myName.trim();
    if (!trimmed) {
      showToast('닉네임을 입력해주세요!', 'error');
      return;
    }
    if (players.length >= 16 && !myPlayerRecord) {
      showToast('최대 16명까지 참여할 수 있습니다.', 'error');
      return;
    }

    try {
      sfx.playPop();
      const playerId = myPlayerRecord ? myPlayerRecord.id : `p_${user.uid}`;
      const playerRef = doc(
        db,
        'artifacts',
        appId,
        'public',
        'data',
        `ladder_players_${roomCode}`,
        playerId
      );
      const color = COLORS[players.length % COLORS.length];

      await setDoc(playerRef, {
        uid: user.uid,
        name: trimmed,
        avatar: myAvatar,
        color: myPlayerRecord ? myPlayerRecord.color : color,
        isProxy: false,
        joinedAt: myPlayerRecord ? myPlayerRecord.joinedAt : Date.now(),
      });
      showToast(
        myPlayerRecord
          ? '프로필이 수정되었습니다!'
          : '참가자 명단에 등록되었습니다!'
      );
    } catch (err) {
      console.error(err);
      showToast('참가 등록에 실패했습니다.', 'error');
    }
  };

  // 호스트 대리 인원 추가 (스마트폰이 없는 인원용)
  const handleAddProxyPlayer = async (e) => {
    e.preventDefault();
    if (!isHost || !roomCode) return;
    const trimmed = proxyName.trim();
    if (!trimmed) return;
    if (players.length >= 16) {
      showToast('최대 16명까지 참여할 수 있습니다.', 'error');
      return;
    }

    try {
      sfx.playPop();
      const randomAvatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
      const color = COLORS[players.length % COLORS.length];
      const colRef = collection(
        db,
        'artifacts',
        appId,
        'public',
        'data',
        `ladder_players_${roomCode}`
      );
      await addDoc(colRef, {
        uid: `proxy_${Date.now()}`,
        name: trimmed,
        avatar: randomAvatar,
        color,
        isProxy: true,
        joinedAt: Date.now(),
      });
      setProxyName('');
      setShowProxyModal(false);
      showToast(`${trimmed} 님이 추가되었습니다.`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemovePlayer = async (playerId) => {
    if (!roomCode) return;
    try {
      const playerRef = doc(
        db,
        'artifacts',
        appId,
        'public',
        'data',
        `ladder_players_${roomCode}`,
        playerId
      );
      await deleteDoc(playerRef);
      sfx.playTick(300);
    } catch (err) {
      console.error(err);
    }
  };

  // ------------------------------------------
  // 호스트: 도착 결과(1~N) 순서 제어 및 당첨 내용 편집
  // ------------------------------------------
  const updateResultsArray = async (newResults) => {
    if (!isHost || !roomCode) return;
    try {
      const roomRef = doc(
        db,
        'artifacts',
        appId,
        'public',
        'data',
        'ladder_rooms',
        roomCode
      );
      await updateDoc(roomRef, { results: newResults });
    } catch (err) {
      console.error(err);
    }
  };

  const moveResultItem = (index, direction) => {
    if (!roomData?.results) return;
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= roomData.results.length) return;
    const copy = [...roomData.results];
    [copy[index], copy[targetIdx]] = [copy[targetIdx], copy[index]];
    sfx.playTick(500);
    updateResultsArray(copy);
  };

  const shuffleResultsOrder = () => {
    if (!roomData?.results) return;
    const copy = [...roomData.results];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    sfx.playPop();
    updateResultsArray(copy);
    showToast('당첨 결과 배치가 무작위로 섞였습니다!');
  };

  const sortResultsAscending = () => {
    if (!roomData?.results) return;
    const copy = [...roomData.results].sort((a, b) => a.rank - b.rank);
    sfx.playTick(440);
    updateResultsArray(copy);
  };

  const handleResultLabelChange = (index, value) => {
    if (!roomData?.results) return;
    const copy = [...roomData.results];
    copy[index] = { ...copy[index], label: value };
    updateResultsArray(copy);
  };

  // ------------------------------------------
  // 호스트: 게임 시작, 다리 재생성, 대기실 리셋
  // ------------------------------------------
  const handleStartGame = async () => {
    if (!isHost || players.length < 2) {
      showToast('최소 2명 이상의 참가자가 필요합니다!', 'error');
      return;
    }
    try {
      const density = roomData.density || 'medium';
      const rungs = generateLadderRungs(players.length, density);
      const roomRef = doc(
        db,
        'artifacts',
        appId,
        'public',
        'data',
        'ladder_rooms',
        roomCode
      );
      await updateDoc(roomRef, {
        status: 'playing',
        rungs,
        revealedIndices: {},
        showAllPaths: false,
        activeTrace: null,
        startedAt: Date.now(),
      });
      sfx.playFanfare();
    } catch (err) {
      console.error(err);
      showToast('게임 시작 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleRegenerateLadder = async () => {
    if (!isHost || players.length < 2) return;
    try {
      const density = roomData.density || 'medium';
      const rungs = generateLadderRungs(players.length, density);
      const roomRef = doc(
        db,
        'artifacts',
        appId,
        'public',
        'data',
        'ladder_rooms',
        roomCode
      );
      await updateDoc(roomRef, {
        status: 'playing',
        rungs,
        revealedIndices: {},
        showAllPaths: false,
        activeTrace: null,
        startedAt: Date.now(),
      });
      setLocalActiveIndex(null);
      setTraceProgress(0);
      sfx.playPop();
      showToast('새로운 사다리 다리가 생성되었습니다!');
    } catch (err) {
      console.error(err);
    }
  };

  const handleBackToLobby = async () => {
    if (!isHost) return;
    try {
      const roomRef = doc(
        db,
        'artifacts',
        appId,
        'public',
        'data',
        'ladder_rooms',
        roomCode
      );
      await updateDoc(roomRef, {
        status: 'lobby',
        revealedIndices: {},
        showAllPaths: false,
        activeTrace: null,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleChangeDensity = async (newDensity) => {
    if (!isHost) return;
    const roomRef = doc(
      db,
      'artifacts',
      appId,
      'public',
      'data',
      'ladder_rooms',
      roomCode
    );
    await updateDoc(roomRef, { density: newDensity });
    sfx.playTick(550);
  };

  // ------------------------------------------
  // 실시간 사다리 경로 추적 동기화 (모든 접속 기기 동시 재생)
  // ------------------------------------------
  const computedTraces = useMemo(() => {
    if (
      !roomData ||
      (roomData.status !== 'playing' && roomData.status !== 'finished') ||
      players.length < 2
    ) {
      return [];
    }
    const rungs = roomData.rungs || [];
    const results = roomData.results || [];
    return players.map((player, idx) => {
      const { points, endCol } = traceLadderPath(idx, players.length, rungs);
      const matchedResult = results[endCol] || { rank: endCol + 1, label: '' };
      return {
        playerIndex: idx,
        player,
        points,
        endCol,
        result: matchedResult,
      };
    });
  }, [roomData, players]);

  // Firestore에 추적 이벤트 기록 -> 모든 클라이언트의 onSnapshot이 수신하여 동시에 애니메이션 시작
  const triggerSyncedTrace = async (playerIdx) => {
    if (!roomCode) return;
    // 호스트이거나 본인 캐릭터인 경우 트리거 허용
    const targetPlayer = players[playerIdx];
    const isMyCharacter = targetPlayer && targetPlayer.uid === user?.uid;
    if (!isHost && !isMyCharacter) {
      showToast('호스트가 진행하거나 본인 캐릭터를 클릭해 실행할 수 있습니다.');
      return;
    }

    try {
      const roomRef = doc(
        db,
        'artifacts',
        appId,
        'public',
        'data',
        'ladder_rooms',
        roomCode
      );
      await updateDoc(roomRef, {
        showAllPaths: false,
        activeTrace: {
          playerIndex: playerIdx,
          triggeredAt: Date.now(),
        },
      });
    } catch (err) {
      console.error(err);
    }
  };

  // 로컬에서 실행되는 부드러운 경로 애니메이션 루프
  const runSynchronizedAnimation = (playerIdx) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setLocalActiveIndex(playerIdx);
    setTraceProgress(0);

    const duration = 1800; // 1.8초
    const startTime = performance.now();
    let lastTickStep = 0;

    const animate = (now) => {
      const elapsed = now - startTime;
      const p = Math.min(elapsed / duration, 1);
      setTraceProgress(p);

      const currentStep = Math.floor(p * 12);
      if (currentStep > lastTickStep) {
        lastTickStep = currentStep;
        sfx.playTick(350 + currentStep * 30);
      }

      if (p < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        sfx.playFanfare();
        // 애니메이션 완료 후 Firestore에 해당 참가자 결과 공개 확정 기록
        if (roomCode) {
          const roomRef = doc(
            db,
            'artifacts',
            appId,
            'public',
            'data',
            'ladder_rooms',
            roomCode
          );
          updateDoc(roomRef, {
            [`revealedIndices.${playerIdx}`]: true,
          }).catch(() => {});
        }
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  };

  // 전체 결과 한 번에 공개 (모든 기기 동시 반영)
  const handleRevealAllSynced = async () => {
    if (!isHost || !roomCode) return;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setLocalActiveIndex(null);

    const allMap = {};
    players.forEach((_, idx) => {
      allMap[idx] = true;
    });

    try {
      const roomRef = doc(
        db,
        'artifacts',
        appId,
        'public',
        'data',
        'ladder_rooms',
        roomCode
      );
      await updateDoc(roomRef, {
        status: 'finished',
        showAllPaths: true,
        activeTrace: null,
        revealedIndices: allMap,
      });
      sfx.playFanfare();
    } catch (err) {
      console.error(err);
    }
  };

  // ------------------------------------------
  // 라이브 이모지 리액션 전송
  // ------------------------------------------
  const sendReaction = async (emoji) => {
    if (!user || !roomCode) return;
    sfx.playTick(660);
    try {
      const colRef = collection(
        db,
        'artifacts',
        appId,
        'public',
        'data',
        `ladder_reactions_${roomCode}`
      );
      await addDoc(colRef, {
        emoji,
        sender: myPlayerRecord?.name || (isHost ? '호스트' : '참가자'),
        left: Math.floor(15 + Math.random() * 70),
        createdAt: Date.now(),
      });
    } catch (e) {}
  };

  // ------------------------------------------
  // QR URL, 초대 링크 복사 및 카카오톡 공유용 결과 텍스트 복사
  // ------------------------------------------
  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined' || !roomCode) return '';
    return `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
  }, [roomCode]);

  const qrImageUrl = useMemo(() => {
    if (!shareUrl) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=12&data=${encodeURIComponent(
      shareUrl
    )}`;
  }, [shareUrl]);

  const copyInviteLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    sfx.playPop();
    showToast('초대 링크가 클립보드에 복사되었습니다!');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const copyFinalResultsText = () => {
    if (!computedTraces.length) return;
    const sorted = [...computedTraces].sort(
      (a, b) => a.result.rank - b.result.rank
    );
    const lines = [
      `🎯 [실시간 사다리게임 결과] (방 코드: ${roomCode})`,
      `----------------------------------`,
      ...sorted.map((t) => {
        const labelStr = t.result.label ? ` (${t.result.label})` : '';
        return `${t.result.rank}번${labelStr} ➔ ${t.player.avatar} ${t.player.name}`;
      }),
      `----------------------------------`,
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedResult(true);
    sfx.playPop();
    showToast('카카오톡 공유용 결과 텍스트가 복사되었습니다!');
    setTimeout(() => setCopiedResult(false), 2500);
  };

  // ==========================================
  // 5. 렌더링: 로딩 & 메인 UI
  // ==========================================
  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-400 font-medium">
          Firebase 실시간 멀티플레이 서버 연결 중...
        </p>
      </div>
    );
  }

  const revealedMap = roomData?.revealedIndices || {};
  const showAll = Boolean(roomData?.showAllPaths);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white relative overflow-x-hidden">
      {/* 샌드박스/미리보기 iframe 감지 안내 배너 */}
      {isInIframe && !dismissIframeBanner && (
        <div className="bg-amber-500/15 border-b border-amber-400/30 px-4 py-2.5 text-xs text-amber-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 max-w-5xl mx-auto">
            <ExternalLink className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              현재 미리보기 창에서 실행 중입니다. 스마트폰 QR 스캔으로 외부
              기기에서 접속하려면{' '}
              <strong className="text-white underline">새 탭에서 열기</strong>{' '}
              또는{' '}
              <strong className="text-white">
                웹 배포(Vercel/Netlify) URL
              </strong>
              로 접속해 주세요.
            </span>
          </div>
          <button
            onClick={() => setDismissIframeBanner(true)}
            className="text-amber-300 hover:text-white font-bold px-2 py-0.5 rounded shrink-0"
          >
            닫기
          </button>
        </div>
      )}

      {/* 라이브 떠다니는 이모지 오버레이 */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {reactions.map((r) => (
          <div
            key={r.id}
            style={{ left: `${r.left}%` }}
            className="absolute bottom-20 animate-bounce flex flex-col items-center transition-all duration-1000"
          >
            <span className="text-4xl drop-shadow-lg">{r.emoji}</span>
            <span className="text-[11px] bg-black/70 text-white px-2 py-0.5 rounded-full mt-1 backdrop-blur-sm border border-white/10">
              {r.sender}
            </span>
          </div>
        ))}
      </div>

      {/* 상단 토스트 알림 */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md">
          <div
            className={`px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-md flex items-center gap-3 text-sm font-medium transition-all ${
              toastMsg.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/50 text-rose-100'
                : 'bg-indigo-950/90 border-indigo-400/40 text-indigo-100'
            }`}
          >
            <AlertCircle className="w-5 h-5 shrink-0 text-indigo-400" />
            <span>{toastMsg.msg}</span>
          </div>
        </div>
      )}

      {/* QR 코드 확대 모달 */}
      {showQrModal && roomCode && (
        <div
          onClick={() => setShowQrModal(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-white/15 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl"
          >
            <h3 className="font-black text-xl text-white">
              스마트폰 QR 코드 스캔
            </h3>
            <p className="text-xs text-slate-400">
              카메라 앱으로 아래 QR을 비추면 자동으로 방에 입장합니다.
            </p>
            <div className="bg-white p-4 rounded-2xl inline-block mx-auto">
              <img
                src={qrImageUrl}
                alt="방 입장 QR 코드"
                className="w-56 h-56 object-contain"
              />
            </div>
            <div className="text-2xl font-mono font-black tracking-[0.25em] text-indigo-300">
              {roomCode}
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyInviteLink}
                className="flex-1 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm flex items-center justify-center gap-1.5"
              >
                {copiedLink ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                링크 복사
              </button>
              <button
                onClick={() => setShowQrModal(false)}
                className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 font-bold text-sm"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상단 공통 헤더 */}
      <header className="sticky top-0 z-30 bg-slate-950/75 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div
            onClick={view === 'room' ? handleLeaveRoom : undefined}
            className={`flex items-center gap-2.5 ${
              view === 'room' ? 'cursor-pointer hover:opacity-80' : ''
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white to-indigo-200 bg-clip-text text-transparent">
                QR 라이브 사다리
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {view === 'room' && roomCode && (
              <>
                <button
                  onClick={() => setShowQrModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-xs font-mono font-bold text-indigo-200 border border-indigo-400/30 transition"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  {roomCode}
                </button>
              </>
            )}
            <button
              onClick={toggleMute}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition"
              title={muted ? '소리 켜기' : '음소거'}
            >
              {muted ? (
                <VolumeX className="w-5 h-5 text-rose-400" />
              ) : (
                <Volume2 className="w-5 h-5 text-emerald-400" />
              )}
            </button>
            {view === 'room' && (
              <button
                onClick={handleLeaveRoom}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-rose-500/20 hover:text-rose-300 border border-white/10 text-xs font-semibold transition"
              >
                나가기
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ==========================================
          VIEW 1: 홈 화면 (방 개설 / 6자리 코드 입장)
         ========================================== */}
      {view === 'home' && (
        <main className="max-w-md mx-auto px-4 py-10 sm:py-16 flex flex-col gap-6">
          <div className="text-center space-y-3 mb-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
              <QrCode className="w-4 h-4" /> Firebase 실시간 다중 기기 동기화
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight">
              모두가 함께 보는
              <br />
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                실시간 사다리게임
              </span>
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              호스트가 방을 만들고 QR 코드를 띄우면,
              <br />
              참가자들이 각자 스마트폰으로 스캔해 실시간으로 참여합니다!
            </p>
          </div>

          {/* 호스트 방 생성 카드 */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">
                  호스트로 새 방 만들기
                </h3>
                <p className="text-xs text-slate-400">
                  QR 코드 생성, 당첨 순서 배치 및 게임 진행
                </p>
              </div>
            </div>
            <button
              onClick={handleCreateRoom}
              disabled={isLoading}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 active:scale-[0.99] font-bold text-white shadow-lg shadow-indigo-500/25 transition flex items-center justify-center gap-2 text-base"
            >
              <QrCode className="w-5 h-5" />
              {isLoading ? '방 생성 중...' : '방 만들고 QR 코드 띄우기'}
            </button>
          </div>

          <div className="flex items-center gap-3 px-4">
            <div className="h-px bg-white/10 flex-1" />
            <span className="text-xs font-semibold text-slate-500">
              또는 초대 코드로 입장
            </span>
            <div className="h-px bg-white/10 flex-1" />
          </div>

          {/* 참가자 코드 입력 카드 */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">
                  참가자로 입장하기
                </h3>
                <p className="text-xs text-slate-400">
                  전달받은 6자리 방 코드를 입력하세요
                </p>
              </div>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                enterRoom();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                maxLength={6}
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                placeholder="코드 6자리 (예: A7K9P2)"
                className="flex-1 min-w-0 bg-slate-900/90 border border-white/15 rounded-2xl px-4 py-3.5 text-center font-mono text-lg font-bold tracking-widest uppercase text-white placeholder:text-slate-600 placeholder:text-xs placeholder:tracking-normal focus:outline-none focus:border-emerald-400"
              />
              <button
                type="submit"
                disabled={isLoading || joinInput.trim().length < 4}
                className="px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-extrabold transition shrink-0"
              >
                입장
              </button>
            </form>
          </div>
        </main>
      )}

      {/* ==========================================
          VIEW 2: 대기실 (LOBBY) & 실시간 게임 화면 (PLAYING / FINISHED)
         ========================================== */}
      {view === 'room' && roomData && (
        <main className="max-w-5xl mx-auto px-4 py-6 pb-28 space-y-6">
          {/* ------------------------------------------
              STAGE A: 대기실 (인원 모집 및 1~N 결과 순서 설정)
             ------------------------------------------ */}
          {roomData.status === 'lobby' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* 왼쪽 컬럼 (5칸): QR 코드 초대 카드 & 참가자 본인 닉네임 등록 */}
              <div className="lg:col-span-5 space-y-6">
                {/* QR 코드 및 초대 코드 카드 */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md text-center space-y-4 shadow-xl">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold">
                    <QrCode className="w-3.5 h-3.5" /> 카메라로 QR 스캔하여 입장
                  </div>

                  <div
                    onClick={() => setShowQrModal(true)}
                    className="bg-white p-3.5 rounded-2xl inline-block shadow-inner mx-auto cursor-pointer hover:scale-[1.02] transition"
                    title="클릭하여 QR 코드 크게 보기"
                  >
                    {qrImageUrl ? (
                      <img
                        src={qrImageUrl}
                        alt="방 입장 QR 코드"
                        className="w-44 h-44 sm:w-48 sm:h-48 object-contain"
                      />
                    ) : (
                      <div className="w-44 h-44 bg-slate-200 animate-pulse rounded-xl" />
                    )}
                  </div>

                  <div>
                    <p className="text-xs text-slate-400 mb-1">방 초대 코드</p>
                    <div className="text-3xl font-mono font-black tracking-[0.2em] text-white">
                      {roomCode}
                    </div>
                  </div>

                  <button
                    onClick={copyInviteLink}
                    className="w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-semibold flex items-center justify-center gap-2 transition"
                  >
                    {copiedLink ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-indigo-300" />
                    )}
                    {copiedLink ? '초대 링크 복사 완료!' : '참여 링크 복사하기'}
                  </button>
                </div>

                {/* 참가자 본인 이름 등록/수정 폼 */}
                <div className="bg-gradient-to-b from-indigo-900/40 to-slate-900/60 border border-indigo-400/30 rounded-3xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-base text-white flex items-center gap-2">
                      <UserPlus className="w-5 h-5 text-indigo-400" />
                      {myPlayerRecord
                        ? '내 참가 정보 수정'
                        : '내 이름 입력하고 참여하기'}
                    </h3>
                    {myPlayerRecord && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
                        참여 완료
                      </span>
                    )}
                  </div>

                  <form onSubmit={handleJoinAsPlayer} className="space-y-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-2">
                        캐릭터 선택
                      </label>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {AVATARS.map((emo) => (
                          <button
                            type="button"
                            key={emo}
                            onClick={() => {
                              setMyAvatar(emo);
                              sfx.playTick(600);
                            }}
                            className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center shrink-0 transition ${
                              myAvatar === emo
                                ? 'bg-indigo-500 scale-110 shadow-lg shadow-indigo-500/40 ring-2 ring-white'
                                : 'bg-white/5 hover:bg-white/10'
                            }`}
                          >
                            {emo}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <input
                        ref={nicknameInputRef}
                        type="text"
                        maxLength={10}
                        value={myName}
                        onChange={(e) => setMyName(e.target.value)}
                        placeholder={
                          myPlayerRecord
                            ? myPlayerRecord.name
                            : '본인 이름 (최대 10자)'
                        }
                        className="flex-1 min-w-0 bg-slate-950/80 border border-white/15 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-400"
                      />
                      <button
                        type="submit"
                        className="px-5 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold transition shrink-0 shadow-lg shadow-indigo-500/25"
                      >
                        {myPlayerRecord ? '수정' : '등록'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* 오른쪽 컬럼 (7칸): 실시간 참가자 현황 & 호스트 결과(1~N) 순서 설정 */}
              <div className="lg:col-span-7 space-y-6">
                {/* 1. 실시간 참가자 리스트 */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-emerald-400" />
                      <h3 className="font-bold text-lg text-white">
                        실시간 참가자{' '}
                        <span className="text-emerald-400 ml-1">
                          {players.length}명
                        </span>
                      </h3>
                    </div>
                    {isHost && (
                      <button
                        onClick={() => setShowProxyModal(!showProxyModal)}
                        className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-indigo-200 flex items-center gap-1.5 transition"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> 직접 인원 추가
                      </button>
                    )}
                  </div>

                  {/* 호스트 대리 인원 추가 인라인 폼 */}
                  {isHost && showProxyModal && (
                    <form
                      onSubmit={handleAddProxyPlayer}
                      className="flex gap-2 p-3 rounded-2xl bg-slate-900/90 border border-indigo-500/30"
                    >
                      <input
                        type="text"
                        maxLength={10}
                        value={proxyName}
                        onChange={(e) => setProxyName(e.target.value)}
                        placeholder="대리 등록할 참가자 이름"
                        className="flex-1 bg-transparent px-2 text-sm text-white focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-xl bg-indigo-500 text-xs font-bold text-white"
                      >
                        추가
                      </button>
                    </form>
                  )}

                  {players.length === 0 ? (
                    <div className="py-10 text-center border-2 border-dashed border-white/10 rounded-2xl">
                      <p className="text-slate-400 text-sm">
                        아직 등록된 참가자가 없습니다.
                      </p>
                      <p className="text-slate-500 text-xs mt-1">
                        QR 코드를 스캔하거나 왼쪽에서 이름을 등록해주세요!
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {players.map((p, idx) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-slate-900/80 border border-white/10"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-8 h-8 rounded-xl flex items-center justify-center text-lg shrink-0"
                              style={{
                                backgroundColor: `${p.color}25`,
                                border: `1px solid ${p.color}60`,
                              }}
                            >
                              {p.avatar}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-white truncate">
                                {p.name}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {idx + 1}번 레인
                              </p>
                            </div>
                          </div>
                          {(isHost || p.uid === user?.uid) && (
                            <button
                              onClick={() => handleRemovePlayer(p.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                              title="제외하기"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. 도착 결과(1부터 N까지 당첨 순서) 설정 섹션 */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-lg text-white flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-400" />
                        도착 결과 배치 (1 ~ {players.length || 'N'})
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {isHost
                          ? '화살표로 당첨 순서를 직접 배치하거나 당첨 내용(예: 커피 쏘기)을 적어보세요.'
                          : '호스트가 하단 도착 결과 순서를 설정하고 있습니다.'}
                      </p>
                    </div>

                    {isHost && players.length >= 2 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={sortResultsAscending}
                          className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 transition"
                        >
                          1~{players.length} 정렬
                        </button>
                        <button
                          onClick={shuffleResultsOrder}
                          className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 text-xs font-bold text-amber-300 flex items-center gap-1 transition"
                        >
                          <Shuffle className="w-3.5 h-3.5" /> 순서 섞기
                        </button>
                      </div>
                    )}
                  </div>

                  {players.length < 2 ? (
                    <div className="py-8 text-center bg-slate-900/50 rounded-2xl border border-white/5 text-xs text-slate-400">
                      참가자가 2명 이상 등록되면 1번부터 N번까지 결과 칸이
                      자동으로 생성됩니다.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(roomData.results || []).map((res, idx) => (
                        <div
                          key={res.id || idx}
                          className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-slate-900/90 border border-white/10"
                        >
                          <span className="text-xs font-mono text-slate-500 w-12 text-center shrink-0">
                            {idx + 1}번 칸
                          </span>

                          <div
                            className={`w-9 h-9 rounded-xl font-black text-base flex items-center justify-center shrink-0 ${
                              res.rank === 1
                                ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/30'
                                : 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30'
                            }`}
                          >
                            {res.rank}
                          </div>

                          {isHost ? (
                            <input
                              type="text"
                              maxLength={18}
                              value={res.label || ''}
                              onChange={(e) =>
                                handleResultLabelChange(idx, e.target.value)
                              }
                              placeholder={`${res.rank}번 당첨 내용 (예: 커피 쏘기)`}
                              className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
                            />
                          ) : (
                            <div className="flex-1 min-w-0 px-2 text-sm font-medium text-slate-200 truncate">
                              {res.label ? res.label : `${res.rank}번 당첨`}
                            </div>
                          )}

                          {isHost && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => moveResultItem(idx, -1)}
                                disabled={idx === 0}
                                className="p-2 rounded-lg bg-white/5 hover:bg-white/15 disabled:opacity-25 text-slate-300 transition"
                                title="앞 칸으로 이동"
                              >
                                <ArrowLeft className="w-4 h-4 rotate-90" />
                              </button>
                              <button
                                onClick={() => moveResultItem(idx, 1)}
                                disabled={idx === roomData.results.length - 1}
                                className="p-2 rounded-lg bg-white/5 hover:bg-white/15 disabled:opacity-25 text-slate-300 transition"
                                title="뒷 칸으로 이동"
                              >
                                <ArrowRight className="w-4 h-4 rotate-90" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 호스트 전용: 가로줄 복잡도 & 게임 시작 버튼 */}
                  {isHost ? (
                    <div className="pt-3 border-t border-white/10 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <Sliders className="w-4 h-4 text-indigo-400" /> 가로줄
                          개수 (복잡도)
                        </span>
                        <div className="flex gap-1.5 bg-slate-950 p-1 rounded-xl border border-white/10">
                          {[
                            { id: 'low', label: '적음' },
                            { id: 'medium', label: '보통' },
                            { id: 'high', label: '많음' },
                          ].map((opt) => (
                            <button
                              key={opt.id}
                              onClick={() => handleChangeDensity(opt.id)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                                (roomData.density || 'medium') === opt.id
                                  ? 'bg-indigo-500 text-white'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={handleStartGame}
                        disabled={players.length < 2}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 disabled:opacity-40 text-slate-950 font-black text-lg shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition active:scale-[0.99]"
                      >
                        <Play className="w-6 h-6 fill-slate-950" />
                        사다리 게임 시작하기 ({players.length}명)
                      </button>
                    </div>
                  ) : (
                    <div className="pt-3 border-t border-white/10 text-center">
                      <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-500/15 border border-indigo-400/30 text-indigo-200 text-xs font-semibold">
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                        호스트가 게임을 시작할 때까지 잠시만 기다려주세요!
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------
              STAGE B: 실시간 동기화 사다리 타기 & 결과 화면
             ------------------------------------------ */}
          {(roomData.status === 'playing' ||
            roomData.status === 'finished') && (
            <div className="space-y-6">
              {/* 상단 컨트롤 바 */}
              <div className="bg-white/5 border border-white/10 rounded-3xl p-4 sm:p-5 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-black text-lg sm:text-xl text-white flex items-center gap-2">
                    🎯 실시간 사다리 타기
                  </h2>
                  <p className="text-xs text-slate-400">
                    상단 참가자 캐릭터를 클릭하면 모든 참가자 화면에 동시에
                    사다리 경로가 재생됩니다!
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isHost && (
                    <>
                      <button
                        onClick={handleRevealAllSynced}
                        className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs sm:text-sm flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition"
                      >
                        <Eye className="w-4 h-4" /> 전체 결과 동시 공개
                      </button>
                      <button
                        onClick={handleRegenerateLadder}
                        className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 transition"
                      >
                        <Shuffle className="w-4 h-4 text-indigo-300" /> 다리
                        다시 섞기
                      </button>
                      <button
                        onClick={handleBackToLobby}
                        className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs sm:text-sm font-semibold text-slate-300 flex items-center gap-1.5 transition"
                      >
                        <RotateCcw className="w-4 h-4" /> 대기실로
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* 메인 사다리 보드 */}
              <div className="bg-slate-950/90 border border-white/15 rounded-3xl p-4 sm:p-6 shadow-2xl overflow-x-auto">
                <div
                  className="mx-auto"
                  style={{
                    minWidth: `${Math.max(players.length * 76, 320)}px`,
                  }}
                >
                  {/* 1) 상단 출발지: 참가자 버튼 목록 */}
                  <div
                    className="grid gap-1 mb-3"
                    style={{
                      gridTemplateColumns: `repeat(${players.length}, minmax(0, 1fr))`,
                    }}
                  >
                    {players.map((p, idx) => {
                      const isTracing =
                        localActiveIndex === idx && traceProgress < 1;
                      const isDone = Boolean(revealedMap[idx]);
                      const canClick = isHost || p.uid === user?.uid;

                      return (
                        <button
                          key={p.id}
                          onClick={() => triggerSyncedTrace(idx)}
                          className={`flex flex-col items-center p-2 rounded-2xl border transition-all ${
                            isTracing
                              ? 'bg-indigo-600/40 border-indigo-400 scale-105 shadow-lg shadow-indigo-500/30'
                              : isDone
                              ? 'bg-white/10 border-white/25'
                              : canClick
                              ? 'bg-white/5 border-white/10 hover:bg-white/15 hover:scale-105 cursor-pointer'
                              : 'bg-white/5 border-white/5 opacity-80 cursor-default'
                          }`}
                        >
                          <span
                            className="w-10 h-10 rounded-full flex items-center justify-center text-xl mb-1 shadow-md"
                            style={{ backgroundColor: p.color }}
                          >
                            {p.avatar}
                          </span>
                          <span className="text-xs font-bold text-white truncate w-full text-center">
                            {p.name}
                          </span>
                          <span className="text-[10px] text-indigo-300 mt-0.5 font-semibold">
                            {isTracing
                              ? '이동중...'
                              : isDone
                              ? '완료'
                              : canClick
                              ? '클릭▶'
                              : '대기'}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* 2) 중앙 SVG 사다리 캔버스 */}
                  <div className="relative w-full h-[360px] sm:h-[420px] select-none">
                    <LadderSVGCanvas
                      players={players}
                      rungs={roomData.rungs || []}
                      computedTraces={computedTraces}
                      activeTraceIndex={localActiveIndex}
                      traceProgress={traceProgress}
                      revealedPlayers={revealedMap}
                      showAllPaths={showAll}
                    />
                  </div>

                  {/* 3) 하단 도착지: 1 ~ N 결과 카드 */}
                  <div
                    className="grid gap-1.5 mt-3"
                    style={{
                      gridTemplateColumns: `repeat(${players.length}, minmax(0, 1fr))`,
                    }}
                  >
                    {(roomData.results || []).map((res, colIdx) => {
                      const arrivedTrace = computedTraces.find(
                        (t) =>
                          t.endCol === colIdx &&
                          (showAll || revealedMap[t.playerIndex])
                      );

                      return (
                        <div
                          key={res.id || colIdx}
                          className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-center transition-all ${
                            arrivedTrace
                              ? 'bg-gradient-to-b from-amber-500/25 to-indigo-900/40 border-amber-400/60 shadow-lg'
                              : 'bg-white/5 border-white/10'
                          }`}
                        >
                          <span
                            className={`w-7 h-7 rounded-lg font-black text-sm flex items-center justify-center mb-1 ${
                              res.rank === 1
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-white/15 text-white'
                            }`}
                          >
                            {res.rank}
                          </span>
                          {res.label && (
                            <span className="text-[11px] font-bold text-amber-200 line-clamp-1 mb-1">
                              {res.label}
                            </span>
                          )}
                          {arrivedTrace ? (
                            <div className="mt-0.5 px-2 py-0.5 rounded-full bg-black/50 text-[11px] font-bold text-emerald-300 truncate max-w-full">
                              {arrivedTrace.player.avatar}{' '}
                              {arrivedTrace.player.name}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500">
                              ?
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 최종 결과 요약 카드 (공개된 인원이 있을 경우 실시간 업데이트) */}
              {(showAll || Object.keys(revealedMap).length > 0) && (
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-black text-lg text-white flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-amber-400" />
                      당첨 결과 현황표
                    </h3>
                    <button
                      onClick={copyFinalResultsText}
                      className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      {copiedResult ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Share2 className="w-4 h-4" />
                      )}
                      {copiedResult ? '결과 복사됨!' : '카톡 공유용 결과 복사'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {[...computedTraces]
                      .filter((t) => showAll || revealedMap[t.playerIndex])
                      .sort((a, b) => a.result.rank - b.result.rank)
                      .map((t) => (
                        <div
                          key={t.player.id}
                          className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/90 border border-white/10"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-xl">{t.player.avatar}</span>
                            <span className="font-bold text-sm text-white truncate">
                              {t.player.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <ChevronRight className="w-4 h-4 text-slate-600" />
                            <span
                              className={`px-2.5 py-1 rounded-xl text-xs font-black ${
                                t.result.rank === 1
                                  ? 'bg-amber-400 text-slate-950'
                                  : 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/30'
                              }`}
                            >
                              {t.result.rank}번{' '}
                              {t.result.label ? `(${t.result.label})` : ''}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 하단 고정 라이브 이모지 리액션 바 */}
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30">
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-slate-900/90 border border-white/15 shadow-2xl backdrop-blur-xl">
              <span className="text-[11px] font-bold text-slate-400 px-2 hidden sm:inline-flex items-center gap-1">
                <MessageCircleHeart className="w-3.5 h-3.5 text-pink-400" />{' '}
                라이브 반응
              </span>
              {['🎉', '😱', '🔥', '😂', '👏', '💀'].map((emo) => (
                <button
                  key={emo}
                  onClick={() => sendReaction(emo)}
                  className="w-10 h-10 rounded-full hover:bg-white/15 active:scale-125 flex items-center justify-center text-xl transition"
                >
                  {emo}
                </button>
              ))}
            </div>
          </div>
        </main>
      )}
    </div>
  );
}

// ==========================================
// 6. SVG 사다리 시각화 및 실시간 경로 추적 컴포넌트
// ==========================================
function LadderSVGCanvas({
  players,
  rungs,
  computedTraces,
  activeTraceIndex,
  traceProgress,
  revealedPlayers,
  showAllPaths,
}) {
  const count = players.length;
  if (count < 2) return null;

  const getColX = (colIndex) => ((colIndex + 0.5) / count) * 100;

  const buildPartialPolyline = (points, progress = 1) => {
    if (!points || points.length < 2) return { poly: '', head: null };

    const segments = [];
    let totalLen = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const x1 = getColX(points[i].col);
      const y1 = points[i].y * 100;
      const x2 = getColX(points[i + 1].col);
      const y2 = points[i + 1].y * 100;
      const len = Math.hypot(x2 - x1, y2 - y1);
      segments.push({ x1, y1, x2, y2, len });
      totalLen += len;
    }

    const targetLen = totalLen * progress;
    let accumulated = 0;
    const coords = [`${segments[0].x1},${segments[0].y1}`];
    let head = { x: segments[0].x1, y: segments[0].y1 };

    for (const seg of segments) {
      if (accumulated + seg.len <= targetLen) {
        coords.push(`${seg.x2},${seg.y2}`);
        head = { x: seg.x2, y: seg.y2 };
        accumulated += seg.len;
      } else {
        const remain = targetLen - accumulated;
        const ratio = seg.len > 0 ? remain / seg.len : 0;
        const hx = seg.x1 + (seg.x2 - seg.x1) * ratio;
        const hy = seg.y1 + (seg.y2 - seg.y1) * ratio;
        coords.push(`${hx},${hy}`);
        head = { x: hx, y: hy };
        break;
      }
    }

    return { poly: coords.join(' '), head };
  };

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="w-full h-full overflow-visible"
    >
      {/* 1. 기본 세로 기둥 */}
      {players.map((_, idx) => {
        const x = getColX(idx);
        return (
          <line
            key={`v_${idx}`}
            x1={x}
            y1={0}
            x2={x}
            y2={100}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="0.6"
            strokeLinecap="round"
          />
        );
      })}

      {/* 2. 랜덤 생성된 가로줄(다리) */}
      {rungs.map((rung, idx) => {
        const x1 = getColX(rung.col);
        const x2 = getColX(rung.col + 1);
        const y = rung.y * 100;
        return (
          <line
            key={`r_${idx}`}
            x1={x1}
            y1={y}
            x2={x2}
            y2={y}
            stroke="rgba(255,255,255,0.28)"
            strokeWidth="0.65"
            strokeLinecap="round"
          />
        );
      })}

      {/* 3. 이미 공개되었거나 전체 공개된 경로들 */}
      {computedTraces.map((trace) => {
        const isCurrentAnimating =
          activeTraceIndex === trace.playerIndex && traceProgress < 1;
        const shouldShowFull =
          showAllPaths ||
          (revealedPlayers[trace.playerIndex] && !isCurrentAnimating);
        if (!shouldShowFull) return null;

        const { poly } = buildPartialPolyline(trace.points, 1);
        return (
          <polyline
            key={`trace_${trace.playerIndex}`}
            points={poly}
            fill="none"
            stroke={trace.player.color}
            strokeWidth="1.15"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={
              activeTraceIndex !== null && traceProgress < 1 ? 0.25 : 0.85
            }
          />
        );
      })}

      {/* 4. 현재 실시간 동기화 애니메이션 중인 경로 하이라이트 */}
      {activeTraceIndex !== null &&
        computedTraces[activeTraceIndex] &&
        (() => {
          const activeTrace = computedTraces[activeTraceIndex];
          const { poly, head } = buildPartialPolyline(
            activeTrace.points,
            traceProgress
          );
          return (
            <g>
              <polyline
                points={poly}
                fill="none"
                stroke={activeTrace.player.color}
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.35"
              />
              <polyline
                points={poly}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="1.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {head && (
                <ellipse
                  cx={head.x}
                  cy={head.y}
                  rx="1.6"
                  ry="1.2"
                  fill={activeTrace.player.color}
                  stroke="#FFFFFF"
                  strokeWidth="0.5"
                />
              )}
            </g>
          );
        })()}
    </svg>
  );
}

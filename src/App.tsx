import React, { useState, useCallback, useRef } from 'react';
import { useInterval } from './useInterval';
import { Trophy, Play, RotateCcw } from 'lucide-react';

const GRID_SIZE = 20;
const INITIAL_SPEED = 150;
const MIN_SPEED = 50;

type Point = { x: number; y: number };
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

const DIRECTION_MAP: Record<Direction, Point> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT',
};

const getRandomFoodPosition = (snake: Point[]): Point => {
  let newFood: Point;
  while (true) {
    newFood = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
    // eslint-disable-next-line
    const isOnSnake = snake.some((segment) => segment.x === newFood.x && segment.y === newFood.y);
    if (!isOnSnake) break;
  }
  return newFood;
};

const INITIAL_SNAKE: Point[] = [
  { x: 10, y: 10 },
  { x: 10, y: 11 },
  { x: 10, y: 12 },
];

export default function App() {
  const [snake, setSnake] = useState<Point[]>(INITIAL_SNAKE);
  const [direction, setDirection] = useState<Direction>('UP');
  const [food, setFood] = useState<Point>({ x: 5, y: 5 });
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [isStarted, setIsStarted] = useState<boolean>(false);

  // 현재 실행된 방향과, 예약된(큐에 담긴) 방향들을 관리하여 연속 조작 최적화
  const currentDirectionRef = useRef<Direction>('UP');
  const directionQueueRef = useRef<Direction[]>([]);

  // 모바일 스와이프를 위한 터치 좌표 기억
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const enqueueDirection = useCallback((newDir: Direction) => {
    const lastWantedDir = directionQueueRef.current.length > 0
      ? directionQueueRef.current[directionQueueRef.current.length - 1]
      : currentDirectionRef.current;

    // 정반대 방향이 아니며, 직전 예상 방향과 파생이 다를 때만 큐에 추가
    if (OPPOSITE_DIRECTION[lastWantedDir] !== newDir && lastWantedDir !== newDir) {
      directionQueueRef.current.push(newDir);
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // 방향키를 눌렀을 때 화면 스크롤 방지
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (!isStarted || isGameOver) {
        if (e.key === ' ' || e.key === 'Enter') {
          startGame();
        }
        return;
      }

      let newDir: Direction | null = null;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          newDir = 'UP';
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          newDir = 'DOWN';
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          newDir = 'LEFT';
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          newDir = 'RIGHT';
          break;
      }

      if (newDir) {
        enqueueDirection(newDir);
      }
    },
    [isStarted, isGameOver, enqueueDirection]
  );

  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const moveSnake = useCallback(() => {
    if (isGameOver || !isStarted) return;

    // 큐에서 다음 이동할 방향을 꺼내 적용
    let dirToUse = currentDirectionRef.current;
    if (directionQueueRef.current.length > 0) {
      dirToUse = directionQueueRef.current.shift()!;
      setDirection(dirToUse);
      currentDirectionRef.current = dirToUse;
    }

    setSnake((prevSnake) => {
      const head = prevSnake[0];
      const moveDelta = DIRECTION_MAP[dirToUse];
      const newHead = { x: head.x + moveDelta.x, y: head.y + moveDelta.y };

      // 충돌 검사: 벽
      if (
        newHead.x < 0 ||
        newHead.x >= GRID_SIZE ||
        newHead.y < 0 ||
        newHead.y >= GRID_SIZE
      ) {
        setIsGameOver(true);
        return prevSnake;
      }

      // 충돌 검사: 자기 몸
      const isSelfCollision = prevSnake.some((segment, index) => {
        if (index === prevSnake.length - 1) return false;
        return segment.x === newHead.x && segment.y === newHead.y;
      });

      if (isSelfCollision) {
        setIsGameOver(true);
        return prevSnake;
      }

      const newSnake = [newHead, ...prevSnake];

      // 아이템(먹이) 섭취
      if (newHead.x === food.x && newHead.y === food.y) {
        setScore((s) => s + 10);
        setFood(getRandomFoodPosition(newSnake));
      } else {
        newSnake.pop(); // 안 먹었으면 꼬리 자르기
      }

      return newSnake;
    });
  }, [food, isGameOver, isStarted]);

  // 점수에 따라 스피드 증가 (난이도 조절)
  const currentSpeed = isStarted && !isGameOver
    ? Math.max(MIN_SPEED, INITIAL_SPEED - Math.floor(score / 30) * 10)
    : null;

  useInterval(moveSnake, currentSpeed);

  const startGame = () => {
    setSnake(INITIAL_SNAKE);
    setDirection('UP');
    currentDirectionRef.current = 'UP';
    directionQueueRef.current = [];
    setScore(0);
    setIsGameOver(false);
    setIsStarted(true);
    setFood(getRandomFoodPosition(INITIAL_SNAKE));
  };

  // 모바일 스와이프 처리
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isStarted || isGameOver) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isStarted || isGameOver || !touchStartRef.current) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const dx = touchEndX - touchStartRef.current.x;
    const dy = touchEndY - touchStartRef.current.y;

    // 스와이프 민감도 (픽셀)
    const threshold = 30;

    if (Math.abs(dx) > Math.max(Math.abs(dy), threshold)) {
      // 수평 스와이프
      const newDir: Direction = dx > 0 ? 'RIGHT' : 'LEFT';
      enqueueDirection(newDir);
    } else if (Math.abs(dy) > Math.max(Math.abs(dx), threshold)) {
      // 수직 스와이프
      const newDir: Direction = dy > 0 ? 'DOWN' : 'UP';
      enqueueDirection(newDir);
    }

    touchStartRef.current = null;
  };

  return (
    <div
      className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 overflow-hidden relative"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background Decor */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-rose-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="w-full max-w-md flex justify-between items-center mb-6 z-10 px-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
          SNAKE
        </h1>
        <div className="flex items-center gap-2 bg-slate-900/50 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/10">
          <Trophy className="w-5 h-5 text-emerald-400" />
          <span className="text-2xl font-mono font-bold text-white">{score}</span>
        </div>
      </div>

      {/* Game Board Container */}
      <div className="relative z-10 p-2 md:p-3 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl">
        <div
          className="grid gap-[1px] bg-slate-800/50 border border-slate-700/50 rounded-lg overflow-hidden"
          style={{
            gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
            width: 'min(90vw, 400px)',
            height: 'min(90vw, 400px)'
          }}
        >
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, index) => {
            const x = index % GRID_SIZE;
            const y = Math.floor(index / GRID_SIZE);

            const isHead = snake[0].x === x && snake[0].y === y;
            const isBody = snake.some((seg, idx) => idx !== 0 && seg.x === x && seg.y === y);
            const isFood = food.x === x && food.y === y;

            return (
              <div
                key={index}
                className={`w-full h-full rounded-sm transition-all duration-75 relative
                  ${isHead ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)] z-10 scale-105' : ''}
                  ${isBody ? 'bg-emerald-500/80 shadow-[0_0_5px_rgba(52,211,153,0.4)]' : ''}
                  ${isFood ? 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.8)] scale-110 z-10 animate-pulse rounded-full' : ''}
                  ${!isHead && !isBody && !isFood ? 'bg-slate-900/40' : ''}
                `}
              >
                {/* 뱀 눈 모양 (머리) */}
                {isHead && (
                  <div className={`absolute inset-0 flex items-center justify-center gap-[2px] transition-transform
                      ${direction === 'LEFT' || direction === 'RIGHT' ? 'flex-col' : 'flex-row'}
                    `}
                  >
                    <div className="w-1.5 h-1.5 bg-slate-900 rounded-full" />
                    <div className="w-1.5 h-1.5 bg-slate-900 rounded-full" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Start / Game Over Overlay */}
        {(!isStarted || isGameOver) && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm rounded-2xl">
            {isGameOver && (
              <div className="text-center mb-6 animate-in fade-in slide-in-from-bottom-4">
                <h2 className="text-4xl font-black text-rose-500 mb-2 tracking-widest uppercase">
                  Game Over
                </h2>
                <p className="text-slate-300">Final Score: <span className="text-emerald-400 font-bold text-xl">{score}</span></p>
              </div>
            )}

            <button
              onClick={startGame}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-8 py-4 rounded-full transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(52,211,153,0.4)]"
            >
              {isStarted && isGameOver ? (
                <>
                  <RotateCcw className="w-6 h-6" /> Play Again
                </>
              ) : (
                <>
                  <Play className="w-6 h-6" /> Start Game
                </>
              )}
            </button>
            <p className="mt-6 text-sm text-slate-400 text-center px-8">
              <span className="hidden sm:inline">Use <kbd className="bg-slate-800 px-2 py-1 rounded text-slate-200 font-mono text-xs">W</kbd> <kbd className="bg-slate-800 px-2 py-1 rounded text-slate-200 font-mono text-xs">A</kbd> <kbd className="bg-slate-800 px-2 py-1 rounded text-slate-200 font-mono text-xs">S</kbd> <kbd className="bg-slate-800 px-2 py-1 rounded text-slate-200 font-mono text-xs">D</kbd> or Arrows to move.</span>
              <span className="sm:hidden inline">Swipe screen to move.</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

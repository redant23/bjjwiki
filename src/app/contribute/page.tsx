'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  main_category: z.string().min(1, 'Please select a main category'),
  sub_category: z.string().optional(),
  detail_category: z.string().optional(),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  video_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  image_url: z.string().url('Invalid URL').optional().or(z.literal('')),
});

type FormData = z.infer<typeof formSchema>;

const MAIN_CATEGORIES = ['가드', '서브미션', '테이크다운', '스윕', '패스', '이스케이프'];

const SUB_CATEGORIES: Record<string, string[]> = {
  '가드': ['클로즈드 가드', '하프 가드', '오픈 가드'],
  '서브미션': ['초크', '관절기'],
  '테이크다운': ['다리 공격', '메치기'],
  '스윕': ['클로즈드 가드 스윕', '오픈 가드 스윕'],
  '패스': ['스탠딩 패스', '프레셔 패스'],
  '이스케이프': ['마운트 이스케이프', '사이드 컨트롤 이스케이프'],
};

const DETAIL_CATEGORIES: Record<string, string[]> = {
  '하프 가드': ['딥 하프 가드', '락다운', '스윕'],
  '오픈 가드': ['스파이더 가드', '드 라 히바', '버터플라이 가드', 'X 가드'],
  '관절기': ['팔 관절기', '어깨 관절기', '다리 관절기'],
};

export default function ContributePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [selectedMainCategory, setSelectedMainCategory] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const mainCategory = watch('main_category');
  const subCategory = watch('sub_category');

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/techniques', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (json.success) {
        router.push('/');
        // In a real app, show a toast or success message
        alert('기술이 검토를 위해 제출되었습니다!');
      } else {
        setError(json.error || '기술 제출에 실패했습니다');
      }
    } catch (err) {
      setError('오류가 발생했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 lg:py-10">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">기술 기여하기</h1>
          <p className="text-muted-foreground">
            주짓수 위키에 새로운 기술이나 변형을 제출하세요. 모든 제출은 관리자의 검토를 거칩니다.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              기술명
            </label>
            <input
              id="name"
              {...register('name')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="예: 가드에서의 암바"
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="main_category" className="text-sm font-medium">
              Main Category (대분류)
            </label>
            <select
              id="main_category"
              {...register('main_category')}
              onChange={(e) => {
                setSelectedMainCategory(e.target.value);
                setValue('main_category', e.target.value);
                setValue('sub_category', '');
                setValue('detail_category', '');
                setSelectedSubCategory('');
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">대분류 선택</option>
              {MAIN_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {errors.main_category && (
              <p className="text-sm text-red-500">{errors.main_category.message}</p>
            )}
          </div>

          {mainCategory && SUB_CATEGORIES[mainCategory] && (
            <div className="space-y-2">
              <label htmlFor="sub_category" className="text-sm font-medium">
                Sub Category (중분류) - Optional
              </label>
              <select
                id="sub_category"
                {...register('sub_category')}
                onChange={(e) => {
                  setSelectedSubCategory(e.target.value);
                  setValue('sub_category', e.target.value);
                  setValue('detail_category', '');
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">중분류 선택 (선택사항)</option>
                {SUB_CATEGORIES[mainCategory].map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          )}

          {subCategory && DETAIL_CATEGORIES[subCategory] && (
            <div className="space-y-2">
              <label htmlFor="detail_category" className="text-sm font-medium">
                Detail Category (하분류) - Optional
              </label>
              <select
                id="detail_category"
                {...register('detail_category')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">하분류 선택 (선택사항)</option>
                {DETAIL_CATEGORIES[subCategory].map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              설명 (마크다운 지원)
            </label>
            <textarea
              id="description"
              {...register('description')}
              className="flex min-h-[150px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="기술의 단계를 설명해주세요..."
            />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="video_url" className="text-sm font-medium">
              비디오 URL (선택사항)
            </label>
            <input
              id="video_url"
              {...register('video_url')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="https://youtube.com/..."
            />
            {errors.video_url && (
              <p className="text-sm text-red-500">{errors.video_url.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="image_url" className="text-sm font-medium">
              이미지 URL (선택사항)
            </label>
            <input
              id="image_url"
              {...register('image_url')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="https://example.com/image.jpg"
            />
            {errors.image_url && (
              <p className="text-sm text-red-500">{errors.image_url.message}</p>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            {submitting ? '제출 중...' : '기술 제출하기'}
          </button>
        </form>
      </div>
    </div>
  );
}

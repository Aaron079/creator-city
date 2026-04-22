import type { VideoRequest, VideoResponse } from '../../prompts'

// Public domain sample videos (royalty-free, suitable for testing)
const SAMPLE_VIDEOS = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
]

let _idx = 0

export async function mockGenerateVideo(_req: VideoRequest): Promise<VideoResponse> {
  // Simulate longer generation time for video
  await new Promise<void>((r) => setTimeout(r, 1200 + Math.random() * 600))

  const videoUrl = SAMPLE_VIDEOS[_idx % SAMPLE_VIDEOS.length] ?? SAMPLE_VIDEOS[0] ?? ''
  _idx++

  return { videoUrl, source: 'mock' }
}

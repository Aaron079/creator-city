'use client'

import { useEffect, useRef, useState } from 'react'
import { Activity, Camera, Fingerprint, Lock, ShieldCheck, VideoOff } from 'lucide-react'
import styles from './BiometricAccessCard.module.css'

interface BiometricAccessCardProps {
  supported: boolean
  platformAuthenticator: boolean
  loading: boolean
  credentialCount: number
  onRegister: () => void
}

export function BiometricAccessCard({
  supported,
  platformAuthenticator,
  loading,
  credentialCount,
  onRegister,
}: BiometricAccessCardProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [cameraMessage, setCameraMessage] = useState('摄像头不会用于登录，只用于确认设备能力。')

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  const startCameraPreview = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMessage('当前浏览器不支持摄像头权限检测。')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setCameraEnabled(true)
      setCameraMessage('摄像头可用。登录仍由系统 Passkey 安全模块完成。')
    } catch {
      setCameraMessage('无法开启摄像头预览。你仍可以使用系统 Passkey 登录。')
    }
  }

  const stopCameraPreview = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraEnabled(false)
    setCameraMessage('摄像头预览已关闭。')
  }

  return (
    <section className={`${styles.card} mb-6 p-5 md:p-6`}>
      <div className={styles.mesh} />
      <div className="relative grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col justify-between gap-5">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-xs text-white/65">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
              设备安全登录
            </div>
            <h2 className="text-xl font-semibold text-white">Passkey 指纹 / 面部识别登录</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/55">
              使用系统 Passkey 调用 Touch ID、Face ID、Windows Hello 或设备 PIN。
              Creator City 只保存公钥凭证，不读取、不上传、不保存指纹或人脸。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <StatusPill icon={<Fingerprint className="h-4 w-4" />} label="Passkey" value={supported ? '可用' : '不可用'} />
            <StatusPill icon={<Lock className="h-4 w-4" />} label="本机验证器" value={platformAuthenticator ? '已检测' : '未检测'} />
            <StatusPill icon={<Activity className="h-4 w-4" />} label="已绑定" value={`${credentialCount} 个`} />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onRegister}
              disabled={!supported || loading}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? '绑定中…' : '绑定本设备 Passkey'}
            </button>
            <button
              type="button"
              onClick={cameraEnabled ? stopCameraPreview : startCameraPreview}
              className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.05] px-4 py-2.5 text-sm text-white/75 transition hover:border-white/24 hover:text-white"
            >
              {cameraEnabled ? <VideoOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              {cameraEnabled ? '关闭摄像头预览' : '检测摄像头'}
            </button>
          </div>
        </div>

        <div className={styles.videoShell}>
          {cameraEnabled ? (
            <video ref={videoRef} autoPlay playsInline muted className={styles.video} />
          ) : (
            <div className="flex h-[190px] flex-col items-center justify-center rounded-[18px] bg-black/25 text-center">
              <Fingerprint className="mb-3 h-10 w-10 text-white/65" />
              <p className="text-sm font-medium text-white">系统 Passkey 验证</p>
              <p className="mt-1 max-w-[260px] text-xs leading-5 text-white/45">
                生物识别由你的设备完成，网站不会接触原始生物特征。
              </p>
            </div>
          )}
          <div className={styles.reflection} />
          <p className="mt-3 text-xs leading-5 text-white/45">{cameraMessage}</p>
        </div>
      </div>
    </section>
  )
}

function StatusPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/15 px-3.5 py-3">
      <div className="flex items-center gap-2 text-white/45">
        {icon}
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-1 text-sm font-medium text-white">{value}</div>
    </div>
  )
}

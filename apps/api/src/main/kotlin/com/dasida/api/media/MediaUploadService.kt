package com.dasida.api.media

import jakarta.annotation.PostConstruct
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile
import org.springframework.web.server.ResponseStatusException
import java.awt.Color
import java.awt.RenderingHints
import java.awt.image.BufferedImage
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths
import java.util.UUID
import javax.imageio.ImageIO
import kotlin.math.roundToInt

@Service
class MediaUploadService(
    @param:Value("\${app.upload.dir:uploads}") private val uploadDir: String,
    @param:Value("\${app.upload.public-base-url:http://localhost:8080}") private val publicBaseUrl: String,
) {
    @PostConstruct
    fun ensureUploadDir() {
        Files.createDirectories(resolveUploadDir())
    }

    fun store(file: MultipartFile): String {
        if (file.isEmpty) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "file is required")
        }
        val bytes = file.bytes
        if (bytes.isEmpty()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "file is required")
        }
        if (bytes.size > MAX_BYTES) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "file is too large")
        }
        val extension = detectImageExtension(bytes)
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "unsupported image type")

        val id = UUID.randomUUID().toString()
        val dir = resolveUploadDir()

        // webp 은 기본 ImageIO 디코더가 없다. 디코딩 불가(webp·손상 파일)면 원본 그대로 저장하고
        // 썸네일을 만들지 않는다 — 프론트는 썸네일 404 시 원본으로 fallback 한다(FallbackImage thumbnail).
        val image = if (extension == "webp") null else decodeOrNull(bytes)

        val filename = "$id.$extension"
        Files.write(dir.resolve(filename), optimizedOriginal(bytes, image, extension))
        if (image != null) {
            writeThumbnail(image, dir.resolve("$id$THUMB_SUFFIX"))
        }

        val base = publicBaseUrl.trim().trimEnd('/')
        return "$base/uploads/$filename"
    }

    private fun decodeOrNull(bytes: ByteArray): BufferedImage? =
        runCatching { ImageIO.read(ByteArrayInputStream(bytes)) }.getOrNull()

    /** 원본이 MAX_ORIGINAL_DIM 을 넘으면 같은 포맷으로 축소 재인코딩한다. 실패 시 원본을 그대로 쓴다. */
    private fun optimizedOriginal(bytes: ByteArray, image: BufferedImage?, extension: String): ByteArray {
        if (image == null || maxOf(image.width, image.height) <= MAX_ORIGINAL_DIM) return bytes
        val format = if (extension == "png") "png" else "jpg"
        val scaled = scaleToFit(image, MAX_ORIGINAL_DIM, keepAlpha = format == "png")
        val out = ByteArrayOutputStream()
        return if (runCatching { ImageIO.write(scaled, format, out) }.getOrDefault(false)) {
            out.toByteArray()
        } else {
            bytes
        }
    }

    /** 목록 화면용 `<name>.thumb.jpg` 생성. best-effort — 실패해도 업로드는 성공 처리한다. */
    private fun writeThumbnail(image: BufferedImage, target: Path) {
        runCatching {
            val scaled = scaleToFit(image, THUMB_MAX_DIM, keepAlpha = false)
            val out = ByteArrayOutputStream()
            if (ImageIO.write(scaled, "jpg", out)) {
                Files.write(target, out.toByteArray())
            }
        }
    }

    /** 긴 변 기준 maxDim 이하로 축소(확대 없음). JPEG 인코딩용은 투명도를 흰 배경에 합성한다. */
    private fun scaleToFit(src: BufferedImage, maxDim: Int, keepAlpha: Boolean): BufferedImage {
        val ratio = minOf(1.0, maxDim.toDouble() / maxOf(src.width, src.height))
        val width = maxOf(1, (src.width * ratio).roundToInt())
        val height = maxOf(1, (src.height * ratio).roundToInt())
        val type = if (keepAlpha) BufferedImage.TYPE_INT_ARGB else BufferedImage.TYPE_INT_RGB
        val out = BufferedImage(width, height, type)
        val g = out.createGraphics()
        try {
            if (!keepAlpha) {
                g.color = Color.WHITE
                g.fillRect(0, 0, width, height)
            }
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR)
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY)
            g.drawImage(src, 0, 0, width, height, null)
        } finally {
            g.dispose()
        }
        return out
    }

    private fun resolveUploadDir(): Path = Paths.get(uploadDir).toAbsolutePath().normalize()

    companion object {
        private const val MAX_BYTES = 5 * 1024 * 1024

        /** 원본 저장 시 긴 변 상한. 이보다 크면 축소 재인코딩한다. */
        internal const val MAX_ORIGINAL_DIM = 1920

        /** 목록 썸네일 긴 변. 피드 카드(≈600px 폭)까지 커버하는 크기. */
        internal const val THUMB_MAX_DIM = 640

        /** 원본 `<uuid>.<ext>` 옆에 저장되는 썸네일 파일명 접미사. 프론트 uploadThumbUrl 과 규약을 공유한다. */
        internal const val THUMB_SUFFIX = ".thumb.jpg"

        /** magic bytes 로 jpeg/png/webp 만 허용. SVG 등은 XSS·스크립트 위험으로 제외. */
        internal fun detectImageExtension(bytes: ByteArray): String? = when {
            bytes.size >= 3 &&
                bytes[0] == 0xFF.toByte() &&
                bytes[1] == 0xD8.toByte() &&
                bytes[2] == 0xFF.toByte() -> "jpg"
            bytes.size >= 8 &&
                bytes[0] == 0x89.toByte() &&
                bytes[1] == 0x50.toByte() &&
                bytes[2] == 0x4E.toByte() &&
                bytes[3] == 0x47.toByte() -> "png"
            bytes.size >= 12 &&
                bytes[0] == 'R'.code.toByte() &&
                bytes[1] == 'I'.code.toByte() &&
                bytes[2] == 'F'.code.toByte() &&
                bytes[3] == 'F'.code.toByte() &&
                bytes[8] == 'W'.code.toByte() &&
                bytes[9] == 'E'.code.toByte() &&
                bytes[10] == 'B'.code.toByte() &&
                bytes[11] == 'P'.code.toByte() -> "webp"
            else -> null
        }
    }
}

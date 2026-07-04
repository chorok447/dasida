package com.dasida.api.media

import jakarta.annotation.PostConstruct
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile
import org.springframework.web.server.ResponseStatusException
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths
import java.util.UUID

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

        val filename = "${UUID.randomUUID()}.$extension"
        val target = resolveUploadDir().resolve(filename)
        Files.write(target, bytes)

        val base = publicBaseUrl.trim().trimEnd('/')
        return "$base/uploads/$filename"
    }

    private fun resolveUploadDir(): Path = Paths.get(uploadDir).toAbsolutePath().normalize()

    companion object {
        private const val MAX_BYTES = 5 * 1024 * 1024

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

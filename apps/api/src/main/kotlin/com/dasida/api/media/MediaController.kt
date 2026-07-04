package com.dasida.api.media

import com.dasida.api.security.AuthUser
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.MediaType
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile

@RestController
@RequestMapping("/api/media")
@Tag(name = "Media", description = "이미지 업로드 API")
class MediaController(
    private val uploads: MediaUploadService,
) {
    @Operation(summary = "이미지 업로드", description = "jpeg/png/webp 파일을 로컬 디스크에 저장하고 공개 URL을 반환한다.")
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping(consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    fun upload(
        @RequestParam("file") file: MultipartFile,
        @AuthenticationPrincipal user: AuthUser,
    ): MediaUploadResponse = MediaUploadResponse(url = uploads.store(file))
}

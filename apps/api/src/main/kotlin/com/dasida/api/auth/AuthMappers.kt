package com.dasida.api.auth

fun User.toProfile() = UserProfileResponse(
    id = requireNotNull(id),
    email = email,
    name = name,
    verified = verified,
)

fun User.toAuthResponse(token: String) = AuthResponse(token = token, name = name, verified = verified)

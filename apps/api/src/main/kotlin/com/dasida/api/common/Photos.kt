package com.dasida.api.common

/**
 * apps/web/src/data/photos.ts 의 풀을 그대로 재현. 여러 시드(posts/campaigns/...)가 공유.
 * (ponytail: 아바타는 프론트가 이름으로 계산하므로 portrait 풀은 불필요)
 */
object Photos {
    private fun u(id: String, w: Int = 900) =
        "https://images.unsplash.com/$id?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=$w&q=80"

    val workshop = listOf(
        "photo-1606501126768-b78d4569d3f9", "photo-1457972657980-4c9fddebec8d",
        "photo-1641320197434-6ae0ca235048", "photo-1568288796918-03e7d93306bd",
        "photo-1586216583645-bf798306a3d7", "photo-1672302255324-28009cc288b2",
        "photo-1701188516156-10b389bb8e94", "photo-1644288054812-aa3ec742c419",
    ).map { u(it) }

    val nature = listOf(
        "photo-1745327656782-30099136da9c", "photo-1588440691140-09155c1be58a",
        "photo-1613498630970-f2a333cb4974", "photo-1701270631258-ca1a2edbd9c5",
        "photo-1519563161591-80eebb119acc", "photo-1685606350130-2176a0ec7296",
        "photo-1619805640532-21cce5fe542b", "photo-1745063537934-e6bf484d72eb",
    ).map { u(it) }

    val fashion = listOf(
        "photo-1778554986659-741bb4c610a8", "photo-1587088507715-c7705faa3d27",
        "photo-1588195415442-3ea1e61e1322", "photo-1587761383903-4ed7d428e746",
        "photo-1587797283885-9a123e3e88a0", "photo-1778512397881-51b00202ddde",
        "photo-1750343293522-2f08b60a317a", "photo-1615292215322-84c7b9ec441b",
    ).map { u(it) }

    val market = listOf(
        "photo-1640684666381-2e4a56056a0d", "photo-1726572330396-0947f571ac19",
        "photo-1780461475878-17d8c3108857", "photo-1685875018097-3a93223dfac8",
        "photo-1761926783284-6de41a58736d", "photo-1685883518233-4b355cf80a08",
        "photo-1780775119744-f493340e9f79", "photo-1781730441165-069bffd27f90",
    ).map { u(it) }

    val people = listOf(
        "photo-1758599668299-beebedfabf7b", "photo-1624971035514-2bbbc81ea9fe",
        "photo-1758599668356-c8c919e24dda", "photo-1758599668178-d9716bbda9d5",
        "photo-1616680213875-8c6cbae0b933", "photo-1597700112072-fa3c1d930655",
        "photo-1758599669199-a858720a9689", "photo-1758599667729-a6f0f8bd213b",
    ).map { u(it) }

    val obj = listOf(
        "photo-1603905179139-db12ab535ca9", "photo-1612179543058-ab74d388e0ce",
        "photo-1603897076223-17f346f02a03", "photo-1718788392540-0862a47c8c30",
        "photo-1725169412537-acd1cd15e10f", "photo-1724570568441-9755d8e8b6e2",
        "photo-1721190601155-1b98d316bbe2", "photo-1728551040634-db461e235b1f",
    ).map { u(it) }
}

const u = (id: string, w = 900) =>
  `https://images.unsplash.com/${id}?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=${w}&q=80`;

export const workshopPhotos = [
  u("photo-1606501126768-b78d4569d3f9"),
  u("photo-1457972657980-4c9fddebec8d"),
  u("photo-1641320197434-6ae0ca235048"),
  u("photo-1568288796918-03e7d93306bd"),
  u("photo-1586216583645-bf798306a3d7"),
  u("photo-1672302255324-28009cc288b2"),
  u("photo-1701188516156-10b389bb8e94"),
  u("photo-1644288054812-aa3ec742c419"),
];

export const naturePhotos = [
  u("photo-1745327656782-30099136da9c"),
  u("photo-1588440691140-09155c1be58a"),
  u("photo-1613498630970-f2a333cb4974"),
  u("photo-1701270631258-ca1a2edbd9c5"),
  u("photo-1519563161591-80eebb119acc"),
  u("photo-1685606350130-2176a0ec7296"),
  u("photo-1619805640532-21cce5fe542b"),
  u("photo-1745063537934-e6bf484d72eb"),
];

export const fashionPhotos = [
  u("photo-1778554986659-741bb4c610a8"),
  u("photo-1587088507715-c7705faa3d27"),
  u("photo-1588195415442-3ea1e61e1322"),
  u("photo-1587761383903-4ed7d428e746"),
  u("photo-1587797283885-9a123e3e88a0"),
  u("photo-1778512397881-51b00202ddde"),
  u("photo-1750343293522-2f08b60a317a"),
  u("photo-1555529669-e69e7aa0ba9a"),
];

export const marketPhotos = [
  u("photo-1640684666381-2e4a56056a0d"),
  u("photo-1726572330396-0947f571ac19"),
  u("photo-1780461475878-17d8c3108857"),
  u("photo-1685875018097-3a93223dfac8"),
  u("photo-1472851294608-062f824d29cc"),
  u("photo-1685883518233-4b355cf80a08"),
  u("photo-1780775119744-f493340e9f79"),
  u("photo-1567401893414-76b7b1e5a7a5"),
];

export const peoplePhotos = [
  u("photo-1758599668299-beebedfabf7b"),
  u("photo-1624971035514-2bbbc81ea9fe"),
  u("photo-1544027993-37dbfe43562a"),
  u("photo-1511632765486-a01980e01a18"),
  u("photo-1616680213875-8c6cbae0b933"),
  u("photo-1597700112072-fa3c1d930655"),
  u("photo-1469571486292-0ba58a3f068b"),
  u("photo-1758599667729-a6f0f8bd213b"),
];

export const objectPhotos = [
  u("photo-1603905179139-db12ab535ca9"),
  u("photo-1612179543058-ab74d388e0ce"),
  u("photo-1603897076223-17f346f02a03"),
  u("photo-1718788392540-0862a47c8c30"),
  u("photo-1725169412537-acd1cd15e10f"),
  u("photo-1724570568441-9755d8e8b6e2"),
  u("photo-1721190601155-1b98d316bbe2"),
  u("photo-1728551040634-db461e235b1f"),
];

export const pickPhoto = (pool: string[], i: number) => pool[i % pool.length];

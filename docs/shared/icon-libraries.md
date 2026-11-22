# 펫매니저 아이콘 라이브러리

21st의 아이콘 페이지에서 고른 아이콘을 개별 SVG로 저장하는 대신, 원본 패키지에서 이름으로 가져온다. 웹·모바일·공통 코드의 의존성에 아래 7개 세트를 연결했다.

펫매니저 화면의 공통 UI 아이콘은 Tabler 윤곽선 세트를 사용한다. 새 메뉴나 버튼에서도 `@tabler/icons-react`에서 필요한 아이콘을 이름으로 가져온다.

| 21st의 세트 | 연결한 패키지 | 가져오기 예시 |
| --- | --- | --- |
| Lucide | 기존 `lucide-react` 유지 | `Search` |
| Tabler | `@tabler/icons-react` 3.52.0 | `IconSearch` |
| Hugeicons | `@hugeicons/react` 1.1.10 + `@hugeicons/core-free-icons` 4.4.0 | `HugeiconsIcon` + `Search01Icon` |
| Remix | `@remixicon/react` 4.9.0 | `RiSearchLine` |
| Phosphor | `@phosphor-icons/react` 2.1.10 | `MagnifyingGlass` |
| Heroicons | `@heroicons/react` 2.2.0 | `MagnifyingGlassIcon` |
| Material Line | `@iconify/react` 6.0.4 + `@iconify-icons/line-md` 2.0.0 | 로컬 `search` 데이터 |

## 사용하기

21st에서 세트와 아이콘 이름을 확인한다. 예를 들어 `Tabler / search`를 고르면 아래의 `IconSearch`처럼 가져온다. 사이트 표시 이름과 패키지의 컴포넌트 이름은 대소문자와 접두어가 다를 수 있다.

```tsx
"use client";

import { Search } from "lucide-react";
import { IconSearch } from "@tabler/icons-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { RiSearchLine } from "@remixicon/react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Icon } from "@iconify/react/offline";
import searchIcon from "@iconify-icons/line-md/search";

export function IconExamples() {
  return (
    <>
      <Search size={24} />
      <IconSearch size={24} />
      <HugeiconsIcon icon={Search01Icon} size={24} />
      <RiSearchLine size={24} />
      <MagnifyingGlass size={24} />
      <MagnifyingGlassIcon width={24} height={24} />
      <Icon icon={searchIcon} width={24} height={24} />
    </>
  );
}
```

- Phosphor를 Next.js 서버 컴포넌트에서 사용할 때는 `@phosphor-icons/react/ssr`에서 가져온다.
- Material Line은 `@iconify/react/offline`에 로컬 아이콘 데이터를 전달한다. 아이콘을 표시하기 위한 외부 Iconify API 요청이 생기지 않는다. 데이터 import 경로에는 `.js`를 붙이지 않는다.
- 아이콘을 지정할 때는 `Tabler 검색 아이콘`, `Hugeicons 검색 아이콘`처럼 세트와 의미를 함께 적으면 된다.

## 적용 기준

- 사용할 아이콘을 정적 이름으로 import한다. 전체 세트를 한 번에 가져오는 통합 파일이나 `import * as Icons`를 화면에 추가하지 않는다.
- 같은 화면의 메뉴·버튼은 한 세트를 기준으로 맞추고, 기존 크기·색상·선 두께 규칙을 따른다.
- 장식용 아이콘과 아이콘만 있는 버튼은 기존 접근성 규칙을 따른다. 버튼의 기능을 설명하는 한국어 접근성 이름을 유지한다.
- Hugeicons는 무료 원본 데이터 패키지인 `@hugeicons/core-free-icons`를 사용한다.
- 의존성은 원본 패키지의 라이선스 파일을 유지한다. Remix 4.9.0의 라이선스 이름은 `Remix Icon License 1.0`이며, 다른 세트의 MIT/ISC와 구분한다.

## 원본 안내

- [21st 아이콘 검색](https://21st.dev/community/icons)
- [Lucide React](https://lucide.dev/guide/react)
- [Tabler React](https://docs.tabler.io/icons/libraries/react)
- [Hugeicons React](https://github.com/hugeicons/hugeicons/tree/main/packages/react)
- [Remix React 및 라이선스](https://github.com/Remix-Design/RemixIcon)
- [Phosphor React](https://github.com/phosphor-icons/react)
- [Heroicons React](https://github.com/tailwindlabs/heroicons)
- [Material Line](https://github.com/cyberalien/line-md)
- [Iconify React](https://iconify.design/docs/icon-components/react/)

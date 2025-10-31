// content.js
// 이 파일은 확장 프로그램이 활성화된 모든 웹페이지에 삽입됩니다.

// 각 site별 selector모음(댓글 HTML 요소)
const selectorsBySite = {
    'Youtube': '.comment-renderer-text-content, #comment-text',
    'DCinside': '.usertxt.ub-word',
}

// =================================================================
// 1. 핵심 변환 로직 (Core Transformation Logic)
// =================================================================

/**
 * 주어진 DOM 요소 내에서 변환이 필요한 텍스트 노드를 찾아 실제 변환을 적용하는 함수.
 * * @param {Node} targetNode - 텍스트 탐색을 시작할 DOM 노드 (예: 문서 전체 또는 새로 로드된 댓글 컨테이너).
 */
function transformText(targetNode, site) {
    // 텍스트 탐색 및 변환 로직을 여기에 구현합니다.
    // 예를 들어, document.createTreeWalker를 사용하여 텍스트 노드만 효율적으로 순회할 수 있습니다.
    
    // 이 예시에서는 간단히 특정 클래스를 가진 요소만 탐색하는 예시를 보여줍니다.
    
    // TODO: 변환 대상이 되는 선택자를 사이트별로 정의해야 합니다.
    // 예시: 댓글, 게시글 본문 등
    const selectors = selectorsBySite[site];
    console.log(`[텍스트 변환기] 변환 대상 선택자: ${selectors}`);
    console.log(`[텍스트 변환 함수 시작]`);
    // targetNode가 Element인 경우에만 querySelectorAll을 사용
    if (targetNode.nodeType === 1) { // Node.ELEMENT_NODE
        console.log(`[텍스트 변환 시작]`);
        const elements = targetNode.querySelectorAll(selectors);

        elements.forEach(element => {
            // 변환 로직 실행
            let originalText = element.textContent;
            let transformedText = originalText;
            
            // 텍스트 변환 규칙 적용 (예: 특정 단어 치환)
            // transformedText = transformedText.replace(/원하는 단어/g, '변환된 단어');

            // TODO: 여기에 실제 텍스트 변환 로직을 넣으세요.
            // 예시: 텍스트를 모두 대문자로 바꾸기
            transformedText = "변환했습니다."

            // 변환된 텍스트로 업데이트
            if (originalText !== transformedText) {
                element.textContent = transformedText;
                // 변환된 요소임을 표시하는 속성을 추가하여 중복 변환을 방지할 수 있습니다.
                element.setAttribute('data-text-transformed', 'true');
            }
          console.log(`[텍스트 변환 완료]`);
        });
    }
}


// =================================================================
// 2. 초기 탐색 및 실행 함수 (Initial Scan)
// =================================================================

/**
 * 페이지 로딩 직후 또는 일반적인 커뮤니티 사이트에서 한 번 실행되는 탐색 함수.
 * DOM이 완전히 로드된 후 실행되므로 초기 콘텐츠를 처리하기에 적합합니다.
 */
function runInitialScan(site) {
    console.log('[텍스트 변환기] 초기 페이지 탐색 시작');
    // 문서 전체(document.body)를 대상으로 변환을 실행합니다.
    transformText(document.body, site);
    console.log('[텍스트 변환기] 초기 페이지 탐색 완료');
}


// =================================================================
// 3. SPA 대응 로직 (MutationObserver Setup)
// =================================================================

/**
 * SPA(Single Page Application)에서 동적으로 로드되는 콘텐츠를 감지하기 위해
 * MutationObserver를 설정하는 함수입니다.
 */
function setupMutationObserver() {
    console.log('[텍스트 변환기] SPA 환경 감지: MutationObserver 설정 중');

    // MutationObserver 콜백 함수 정의
    const observerCallback = (mutationsList, observer) => {
        for (const mutation of mutationsList) {
            // 자식 노드가 추가된 경우 (주로 새로운 콘텐츠 로드)
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    // Node.ELEMENT_NODE(1)만 처리하여 비효율적인 텍스트 노드 처리를 방지합니다.
                    if (node.nodeType === 1) {
                        // 새로 추가된 노드를 대상으로 텍스트 변환을 실행합니다.
                        transformText(node);
                    }
                });
            }
            // 속성이 변경된 경우도 처리할 수 있으나, 여기서는 childList만 사용
        }
    };

    // Observer 인스턴스 생성 및 설정
    const observer = new MutationObserver(observerCallback);

    const config = { 
        childList: true, // 자식 추가/제거 감지
        subtree: true,   // 전체 하위 트리 감지 (매우 중요)
        attributes: false // 속성 변경은 일단 제외
    };

    // document.body를 대상으로 관찰 시작
    observer.observe(document.body, config);

    // 초기 로드된 콘텐츠도 처리해야 함
    runInitialScan();
    
    console.log('[텍스트 변환기] MutationObserver 관찰 시작');
}


// =================================================================
// 4. 사이트별 핸들러 (Site-Specific Handlers)
// =================================================================

/**
 * YouTube를 위한 전용 핸들러.
 * YouTube는 SPA이므로 MutationObserver를 사용해야 합니다.
 */
function handleYouTube() {
    console.log('[텍스트 변환기] YouTube 전용 핸들러 실행');
    setupMutationObserver();
}

/**
 * DCinside를 위한 전용 핸들러.
 * DCinside는 일반적으로 페이지 로드 시 콘텐츠가 모두 생성되므로 초기 탐색만 수행합니다.
 */
function handleDCinside() {
    console.log('[텍스트 변환기] DCinside 전용 핸들러 실행');
    runInitialScan("DCinside");
}

/**
 * 특별한 처리가 필요 없는 일반적인 사이트를 위한 기본 핸들러.
 */
function defaultHandler() {
    console.log('[텍스트 변환기] 기본 핸들러 실행');
    runInitialScan();
}


// =================================================================
// 5. 메인 실행 함수 (Main Entry Point)
// =================================================================

/**
 * 현재 페이지의 호스트 이름을 확인하고 적절한 핸들러 함수를 실행합니다.
 */
function main() {
    // 현재 페이지의 도메인을 가져옵니다.
    const hostname = window.location.hostname;
    
    // 도메인에 따라 적절한 함수를 선택하여 실행
    if (hostname.includes('youtube.com')) {
        handleYouTube();
    } else if (hostname.includes('dcinside.com')) {
        handleDCinside();
    } else {
        defaultHandler();
    }
}

// 스크립트 실행
main();

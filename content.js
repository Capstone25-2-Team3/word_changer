// content.js
// 이 파일은 확장 프로그램이 활성화된 모든 웹페이지에 삽입됩니다.
const CHECK_INTERVAL = 60000; // 1분 (60초) 간격으로 데이터 확인

let allContents = []; 

let observer = null; // MutationObserver 인스턴스 저장 변수

// 각 site별 selector모음(댓글 HTML 요소)
const selectorsBySite = {
    'Youtube': '#content-text span', //댓글 대상으로만 작동함.
    'DCinside': '.usertxt.ub-word', //댓글 대상으로만 작동함.
}

const nonSPASites = [
    'dcinside.com'
]

// =================================================================
// 0. 비동기 크롤링 요청
// =================================================================
/**
 * 1분마다 호출되어 allContents에 데이터가 있는지 확인하고, 있으면 즉시 업로드를 요청합니다.
 */
function checkAndUploadContent() {
    console.log('⏱️ checkAndUploadContent 함수 실행됨. 현재 누적 데이터:', allContents.length);
    
    // 1. 데이터가 있다면 즉시 업로드 요청
    if (allContents.length > 0) {
        
        console.log("데이터 전송을 시작합니다.");
        
        const finalContent = allContents.join('\n');
        // 파일명에 현재 URL을 포함하려면 window.location.href를 사용합니다.
        const date = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        const hostname = window.location.hostname.replace(/\./g, '_');
        const fileName = `댓글_데이터_${hostname}_${date}.txt`;
        
        // background.js로 메시지 전송
        chrome.runtime.sendMessage({
            action: "upload_text_to_drive",
            textContent: finalContent,
            fileName: fileName
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("메시지 응답 오류:", chrome.runtime.lastError.message);
                return;
            }
            if (response && response.status === "success") {
                console.log(`[업로드 요청 성공] 파일 ID: ${response.fileId}`);
            } else if (response && response.status === "error") {
                console.error(`[업로드 실패] 오류: ${response.error}`);
            }
        });
        
        // 2. 업로드 요청 후 데이터 초기화
        allContents = []; 
        console.log("[업로드 요청 완료] allContents 초기화됨.");
    }
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
    console.log(`[텍스트 변환 함수 시작]`);
    // targetNode가 Element인 경우에만 querySelectorAll을 사용
    if (targetNode.nodeType === 1) { // Node.ELEMENT_NODE
        const unhandledSelector = selectors + ':not([data-text-transformed="true"])';
        const elements = targetNode.querySelectorAll(unhandledSelector);
        
        elements.forEach(element => {
            // 변환 로직 실행
            let originalText = element.textContent;
            let transformedText = originalText;
            
            // 크롤링하기 위한 코드
            if (originalText.trim().length > 0) {
                let cleanedText = originalText.replace(/@.*?\)\s*/g, '').trim(); 
                cleanedText = cleanedText.replace(/- dc App$/, '').trim();
                allContents.push(cleanedText);
                console.log('✅ 텍스트 수집 성공. 현재 누적 개수:', allContents.length);
            }

            // TODO: 여기에 실제 텍스트 변환 로직을 넣어야함.
            
            // 예시: 텍스트를 모두 대문자로 바꾸기
            transformedText = "변환했습니다."

            // 변환된 텍스트로 업데이트
            if (originalText !== transformedText) {
                element.textContent = transformedText;
                // 변환된 요소임을 표시하는 속성을 추가하여 중복 변환을 방지할 수 있습니다.
                element.setAttribute('data-text-transformed', 'true');
            }
        });
    }
}


// =================================================================
// 2. SPA 대응 로직 (MutationObserver Setup)
// =================================================================
/**
 * MutationObserver를 설정하여 DOM 변화를 감지하고 transformText를 호출합니다.
 * @param {string} site 현재 사이트 도메인 (key)
 */
function setupObserver(site) {
    // MutationObserver 콜백 함수 정의
    const callback = (mutationList, observer) => {
        for (const mutation of mutationList) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    // 추가된 노드에 대해 텍스트 변환 로직 실행
                    transformText(node, site); 
                });
            }
        }
    };

    // 옵저버 생성 및 연결
    observer = new MutationObserver(callback);
    // document.body 전체를 감시하는 것이 가장 확실합니다.
    observer.observe(document.body, { 
        childList: true, 
        subtree: true 
    });
    
    // 초기 로드 시 이미 존재하는 텍스트에 대해서도 한 번 실행 (document.body를 대상 노드로 사용)
    transformText(document.body, site);
    const hostname = window.location.hostname;
    for (const site of nonSPASites) {
        if (hostname.includes(site)) {
            console.log(`[Main] Non-SPA 사이트(${site}) 감지. 초기 데이터 전송을 위해 checkAndUploadContent를 명시적으로 실행합니다.`);
            // 이 호출은 setupObserver 내부 호출의 즉시성을 보장하기 위해 추가되었습니다.
            checkAndUploadContent(); 
            break;
        }
    }
    console.log(`[Observer] ${site}의 DOM 감시를 시작했습니다.`);
}


// =================================================================
// 3. 사이트별 핸들러 (Site-Specific Handlers)
// =================================================================

function handleYouTube() {
    setupObserver('Youtube');
}

function handleDCinside() {
    setupObserver('DCinside');
}

function defaultHandler() {
    setupObserver('default');
}


// =================================================================
// 4. 메인 실행 함수 (Main Entry Point)
// =================================================================
/**
 * 현재 페이지의 호스트 이름을 확인하고 적절한 핸들러 함수를 실행합니다.
 * (새 페이지 진입 시 초기화 역할을 수행)
 */
function main() {
    // ⭐️ 1. 이전 Observer 해제
    if (observer) {
        observer.disconnect();
        observer = null;
    }
    
    // 2. 도메인에 따라 적절한 함수를 선택하여 실행
    const hostname = window.location.hostname;
    
    if (hostname.includes('youtube.com')) {
        handleYouTube();
    } else if (hostname.includes('dcinside.com')) {
        handleDCinside();
    } else {
        defaultHandler();
    }
    console.log(`[Main] ${hostname} 페이지 처리 시작 및 Observer 재설정 완료.`);
}

// =================================================================
// 5. SPA 라우팅 변경 감지 (Main 실행 트리거)
// =================================================================
/**
 * SPA에서 URL이 변경될 때 감지하고, Observer를 재설정하기 위해 main()을 호출합니다.
 * 데이터를 업로드하지는 않으며, 오직 페이지 컨텍스트 변경만 처리합니다.
 */
function handlePageNavigation() {
    const newUrl = window.location.href;
    console.log(`🧭 페이지 이동 감지. New URL: ${newUrl}, Current URL: ${currentUrl}`);
    
    // URL이 변경되었을 때만 처리
    if (newUrl !== currentUrl) {
        console.log(`✅ URL 변경 감지! Observer 재설정을 위해 main() 호출.`);
        
        // 1. URL 업데이트
        currentUrl = newUrl;
        // 2. 새 페이지를 처리하기 위해 main() 호출 (Observer 재설정)
        main();
    }
}

// ⭐️ History API 오버라이딩 (URL 변경 시 handlePageNavigation 호출) ⭐️
(function(history){
    // pushState 오버라이딩
    var pushState = history.pushState;
    history.pushState = function(state) {
        pushState.apply(history, arguments);
        handlePageNavigation(); 
    };

    // replaceState 오버라이딩
    var replaceState = history.replaceState;
    history.replaceState = function(state) {
        replaceState.apply(history, arguments);
        handlePageNavigation();
    };
    
    // popstate 이벤트 (뒤로 가기/앞으로 가기)
    window.addEventListener('popstate', function(event) {
        handlePageNavigation();
    });
    
})(window.history);


main();

setInterval(checkAndUploadContent, CHECK_INTERVAL);

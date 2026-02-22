// content.js
// 이 파일은 확장 프로그램이 활성화된 모든 웹페이지에 삽입됩니다.

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


let globalDictionary = {};

let isBlurActive = false;
let isSoftActive = false;

// CSS 스타일 추가
function injectStyles() {
    // 이미 스타일이 주입되었는지 확인하는 식별자
    if (document.getElementById('transformation-styles')) {
        return; 
    }

    const style = document.createElement('style');
    style.id = 'transformation-styles'; // ID를 부여하여 중복 주입 방지
    
    // ⭐ 이전 답변에서 제안된 블라인드 효과를 위한 CSS 정의를 문자열로 삽입합니다.
    style.textContent = `
        .text-blur-in-progress { 
            /* 블러 효과를 추가하여 작업 중임을 시각적으로 표현 */
            filter: blur(4px); 
            /* 부드러운 전환 효과 (선택 사항) */
            transition: color 0.3s, filter 0.3s;
            /* 배경색을 추가하여 글자 영역을 가려 블라인드 느낌 강조 (선택 사항) */
            /* background-color: #f0f0f0; */ 
        }
    `;

    document.head.appendChild(style);
    // console.log("[CSS 주입] 'text-blur-in-progress' 스타일이 DOM에 추가되었습니다.");
}

// --- 함수 사용 예시 ---

function createRequestBody(textList) {
    // 입력된 리스트를 'texts'라는 키의 값으로 할당합니다.
    const requestBody = {
        texts: textList
    };

    return requestBody;
}

const apiUrl = 'http://3.39.120.138:8000/predict';

// 함수 실행 및 결과 처리
async function runPostExample(formData, elementList) {
    try {
        // Background Script로 POST 요청을 위임하는 메시지 전송
        const response = await chrome.runtime.sendMessage({
            action: 'POST_REQUEST', // Background Script에서 확인할 액션 타입
            url: apiUrl,
            data: formData
        });

        const responseData = response.data;

        // 1. responseData의 모든 속성 값(Value)을 배열로 만듭니다.
        //    (내부 객체들 + length: 11)
        const allValues = Object.values(responseData);

        // 2. 이 값들 중에서 'length' (숫자)를 제외하고, 순수한 객체(Object)만 필터링합니다.
        const innerObjects = allValues.filter(value => typeof value === 'object');

        // 3. 필터링된 모든 내부 객체들을 하나의 새로운 객체(딕셔너리)로 병합합니다.
        //    Object.assign({}, ...innerObjects) 또는 { ...innerObjects[0], ...innerObjects[1], ... }와 동일

        const combinedDictionary = Object.assign({}, ...innerObjects);
        globalDictionary = { ...globalDictionary, ...combinedDictionary };

        // console.log(combinedDictionary);

        if (response && response.success) {
            elementList.forEach(element => {
            const originalText = element.getAttribute('data-original-text');
            if (originalText in globalDictionary) {
                element.textContent = globalDictionary[originalText];
                element.setAttribute('data-text-transformed', 'true');
                element.removeAttribute('data-original-text');
                if(isSoftActive || originalText == globalDictionary[originalText])
                    element.classList.remove('text-blur-in-progress');
                console.log(`[변환 완료] 원본: "${originalText}" -> 변환 후: "${globalDictionary[originalText]}"`);
            }
        });
            return response.data;
        } else if (response && response.error) {
            // Background Script에서 fetch가 실패하여 받은 오류 처리
            throw new Error(`Background Fetch Failed: ${response.error}`);
        } else {
            // 메시지 통신 자체의 실패 (예: 리스너가 없을 때)
            throw new Error('Message communication failed or no response received.');
        }

    } catch (error) {
        console.log('❌ 데이터 전송에 실패했습니다. (통신 오류 포함):', error);
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
    // targetNode가 Element인 경우에만 querySelectorAll을 사용
    if (targetNode.nodeType === 1) { // Node.ELEMENT_NODE
        const unhandledSelector = selectors + ':not([data-text-transformed="true"])';
        const elements = targetNode.querySelectorAll(unhandledSelector);
        let sentences = []
        elements.forEach(element => {
            let originalText = element.textContent;
            // console.log("원본 텍스트:", originalText);
            if (originalText in globalDictionary) {
                element.textContent = globalDictionary[originalText];
                element.setAttribute('data-text-transformed', 'true');
                element.removeAttribute('data-original-text');
                element.classList.remove('text-blur-in-progress');
            }
            else {
                sentences.push(originalText);

                element.setAttribute('data-original-text', originalText);

                // 기능 추가 : 신고용 원문 보존(변환 완료 후 data-original-text가 지워지므로 별도 유지)
                element.setAttribute('data-original-text-for-report', originalText);

                element.classList.add('text-blur-in-progress');
                if(sentences.length >= 2){
                    runPostExample(createRequestBody(sentences), elements);
                    sentences.length = 0;
                }
            }
        })
        // GPT를 통한 변환 로직 추가(Directory형식으로 받을 예정임)
        if (sentences.length != 0){
            runPostExample(createRequestBody(sentences), elements);
            sentences.length = 0;
        }
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
                    if(isBlurActive || isSoftActive) transformText(node, site); 
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
    if(isBlurActive || isSoftActive) transformText(document.body, site);
    const hostname = window.location.hostname;
    // console.log(`[Observer] ${site}의 DOM 감시를 시작했습니다.`);
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
async function main() {
    // 1. 이전 옵저버 연결 해제
    if (observer) {
        observer.disconnect();
        observer = null;
    }

    document.querySelectorAll('[data-text-transformed]').forEach(el => {
        el.removeAttribute('data-text-transformed');
        // 필요하다면 원본 텍스트 속성도 제거
        el.removeAttribute('data-original-text'); 
    });

    // 2. 스토리지에서 설정값을 가져올 때까지 '기다림(await)'
    // 결과가 올 때까지 아래 줄(console.log 등)로 넘어가지 않습니다.
    const result = await chrome.storage.local.get(['blurEnabled', 'softEnabled']);
    
    isBlurActive = result.blurEnabled ?? false;
    isSoftActive = result.softEnabled ?? false;

    console.log("✅ 설정 로드 완료 (이후 로직 실행):", isBlurActive, isSoftActive);

    // 4. 도메인별 핸들러 실행
    const hostname = window.location.hostname;
    if (hostname.includes('youtube.com')) {
        handleYouTube();
    } else if (hostname.includes('dcinside.com')) {
        handleDCinside();
    } else {
        defaultHandler();
    }
}

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        if (changes.blurEnabled) {
            isBlurActive = changes.blurEnabled.newValue;
            console.log("Blur 전역변수 변경됨:", isBlurActive);
        }
        if (changes.softEnabled) {
            isSoftActive = changes.softEnabled.newValue;
            console.log("Blur 전역변수 변경됨:", isSoftActive);
        }
    }
});

// =================================================================
// 5. SPA 라우팅 변경 감지 (Main 실행 트리거)
// =================================================================
let currentUrl = window.location.href;

function handleNavigation() {
    const newUrl = window.location.href;
    if (newUrl !== currentUrl) {
        console.log("🚀 URL 변경 감지됨:", newUrl);
        currentUrl = newUrl;
        globalDictionary = {}; // URL 변경 시 사전 초기화
        main(); // Observer 재설정 및 변환 실행
    }
}

// 1. 유튜브 전용 커스텀 이벤트 리스너 (가장 정확함)
window.addEventListener('yt-navigate-finish', handleNavigation);

// 2. 페이지 데이터 업데이트 감지 (추가)
window.addEventListener('yt-page-data-updated', handleNavigation);

// 3. 사용자 클릭 기반 직접 감지 (추가 - 강력 추천)
document.addEventListener('click', (e) => {
    if (e.target.closest('#sort-menu') || e.target.closest('ytd-menu-service-item-renderer')) {
        setTimeout(main, 600);
    }
});

window.addEventListener('locationchange', handleNavigation);

window.addEventListener('popstate', handleNavigation);

injectStyles();
main();


// 기능 추가 : 신고 데이터 수집 유틸 및 메시지 핸들러

// 기능 추가 : 동일 원문 중복 신고 방지(Set)
const reportedHashes = new Set();

// 기능 추가 : sha256(hex) 계산 (원문 기반 중복 제거용)
async function sha256Hex(str) {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
    return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// 기능 추가 : 플랫폼 판별
function detectPlatform() {
    const h = window.location.hostname;
    if (h.includes('youtube.com')) return 'youtube';
    if (h.includes('dcinside.com')) return 'dcinside';
    return 'unknown';
}

// 기능 추가 : 변환 완료된 댓글 수집
async function collectTransformed(site) {
    const selectors = selectorsBySite[site];
    if (!selectors) return [];

    // 변환 완료된 댓글만 수집
    const transformedElements = document.querySelectorAll(
        `${selectors}[data-text-transformed="true"]`
    );

    const results = [];
    const platform = detectPlatform();
    const url = window.location.href;

    for (const el of transformedElements) {
        const original = el.getAttribute('data-original-text-for-report');
        const transformedText = el.textContent;

        if (!original || !original.trim()) continue;

        const hash = await sha256Hex(original);

        if (reportedHashes.has(hash)) continue;
        reportedHashes.add(hash);

        results.push({
            comment_id: crypto.randomUUID(),
            original_text: original,
            transformed_text: transformedText,
            url,
            platform,
            timestamp: new Date().toISOString(),
            model_version: "kobert_v1",
            predicted_labels: {},
            hash
        });
    }

    return results;
}

// 기능 추가 : 신고 모드에서 “선택된 댓글(1개)” 저장 상태
let reportModeEnabled = false;
let selectedReport = null;
let selectedElement = null;

// 기능 추가 : 선택 하이라이트 스타일 주입 (기존 injectStyles는 건드리지 않음)
(function injectReportSelectStyles() {
    if (document.getElementById('report-select-styles')) return;
    const style = document.createElement('style');
    style.id = 'report-select-styles';
    style.textContent = `
        .report-selected-comment {
            outline: 2px solid #2196F3;
            border-radius: 6px;
        }
    `;
    document.head.appendChild(style);
})();

// 기능 추가 : 신고용 클릭 선택은 “댓글 컨테이너”를 잡아야 하므로 selector를 별도로 둠
const reportSelectorsBySite = {
    'Youtube': '#content-text',     // span보다 상위 컨테이너가 클릭 선택에 유리
    'DCinside': '.usertxt.ub-word'
};

// 기능 추가 : 신고 모드 ON 시, 사용자가 클릭한 댓글을 선택
document.addEventListener('click', async (e) => {
    if (!reportModeEnabled) return;

    const hostname = window.location.hostname;
    const site = hostname.includes('youtube.com') ? 'Youtube'
              : hostname.includes('dcinside.com') ? 'DCinside'
              : 'default';

    const selector = reportSelectorsBySite[site];
    if (!selector) return;

    const commentEl = e.target.closest(selector);
    if (!commentEl) return;

    // 변환된 댓글만 선택 대상으로
    if (commentEl.getAttribute('data-text-transformed') !== 'true') return;

    const original = commentEl.getAttribute('data-original-text-for-report');
    const transformedText = commentEl.textContent || '';
    if (!original || !original.trim()) return;

    // 기존 선택 하이라이트 제거
    if (selectedElement) selectedElement.classList.remove('report-selected-comment');
    selectedElement = commentEl;
    selectedElement.classList.add('report-selected-comment');

    const hash = await sha256Hex(original);

    selectedReport = {
        comment_id: crypto.randomUUID(),
        original_text: original,
        transformed_text: transformedText,
        url: window.location.href,
        platform: detectPlatform(),
        timestamp: new Date().toISOString(),
        model_version: "kobert_v1",
        predicted_labels: {},
        hash
    };
}, true);

// 기능 추가 : popup에서 SET_REPORT_MODE / GET_SELECTED_REPORT / CLEAR_SELECTED_REPORT 요청 수신
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {

    if (req.action === 'SET_REPORT_MODE') {
        reportModeEnabled = !!req.enabled;
        sendResponse({ ok: true, enabled: reportModeEnabled });
        return false;
    }

    if (req.action === 'GET_SELECTED_REPORT') {
        sendResponse({ selected: selectedReport });
        return false;
    }

    if (req.action === 'CLEAR_SELECTED_REPORT') {
        if (selectedElement) selectedElement.classList.remove('report-selected-comment');
        selectedElement = null;
        selectedReport = null;
        sendResponse({ ok: true });
        return false;
    }

    // 기능 추가 : 기존(전체 수집) 요청도 유지
    if (req.action === 'COLLECT_TRANSFORMED') {
        const hostname = window.location.hostname;
        const site = hostname.includes('youtube.com') ? 'Youtube'
                    : hostname.includes('dcinside.com') ? 'DCinside'
                    : 'default';

        collectTransformed(site)
            .then(comments => {
                sendResponse({
                    payload: {
                        comments,
                        extension_version: "1.0",
                        report_type: "fine_tuning_collection"
                    }
                });
            })
            .catch(err => {
                sendResponse({ error: err.message });
            });

        return true; // async sendResponse
    }

    return false;
});
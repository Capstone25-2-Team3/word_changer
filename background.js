// background.js 파일 내용

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "option1",
    title: "옵션 1 선택",
    contexts: ["action"] // 익스텐션 아이콘에서만 보이게 설정
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "option1") {
    console.log("아이콘 우클릭 메뉴가 클릭되었습니다.");
  }
});

// 서버로 JSON 데이터를 POST 요청으로 전송하는 비동기 함수
// 이 함수는 CORS 제한이 없는 Background Script 환경에서 실행됩니다.
async function postData(url, data) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`);
        }

        return await response.json();

    } catch (error) {
        console.error('Background Script POST 요청 중 오류 발생:', error);
        throw error;
    }
}

// Content Script로부터 메시지를 수신하는 리스너 설정
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    if (request.action === 'POST_REQUEST') {

        const { url, data } = request;

        postData(url, data)
            .then(responseData => {
                sendResponse({ success: true, data: responseData });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });

        return true;
    }

    // 기능 추가 : REPORT_REQUEST 처리
    if (request.action === 'REPORT_REQUEST') {

        const { url, data } = request;

        postData(url, data)
            .then(responseData => {
                sendResponse({ success: true, data: responseData });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });

        return true;
    }

    return false;
});

console.log("Background Service Worker is running.");
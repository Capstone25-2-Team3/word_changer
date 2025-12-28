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
    // Content Script에서 이미 작성하셨던 postData 로직을 그대로 사용합니다.
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        // 응답 상태 확인
        if (!response.ok) {
            // HTTP 오류 시, 상태 코드를 포함하여 오류를 던집니다.
            throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`);
        }

        // 응답 본문을 JSON 객체로 파싱하여 반환
        return await response.json();

    } catch (error) {
        // 네트워크 오류 등을 처리합니다.
        console.error('Background Script POST 요청 중 오류 발생:', error);
        // 에러를 다시 던져서 메시지 응답으로 전달되게 합니다.
        throw error;
    }
}

// Content Script로부터 메시지를 수신하는 리스너 설정
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // 1. 메시지의 action 타입이 우리가 정의한 'POST_REQUEST'인지 확인
    if (request.action === 'POST_REQUEST') {
        
        // 비동기 작업을 처리하므로 'return true;'를 사용하여 sendResponse 콜백을 나중에 호출하겠다고 알립니다.
        // Manifest V3 service_worker에서는 Promise를 반환하는 것이 더 명확합니다.

        const { url, data } = request;
        
        // 2. postData 함수를 호출하고 결과를 Content Script로 전달
        const postPromise = postData(url, data)
            .then(responseData => {
                // 성공적으로 데이터를 받으면 success: true와 함께 데이터를 반환
                sendResponse({ success: true, data: responseData });
            })
            .catch(error => {
                // 오류 발생 시 success: false와 오류 메시지를 반환
                sendResponse({ success: false, error: error.message });
            });
            
        // Manifest V2에서는 return true; 
        // Manifest V3 (Service Worker)에서는 Promise를 반환합니다.
        return true; 
    }
    
    // 다른 메시지 타입은 무시하고, 비동기 응답을 사용하지 않음을 알림
    return false;
});

console.log("Background Service Worker is running.");
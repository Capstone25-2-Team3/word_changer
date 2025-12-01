// background.js
importScripts('serverconnect.js');

// 1. 설정 값
const CLIENT_ID = "971522743683-3c9eh4hhhg0b7hplj58u1jdpod4s94q5.apps.googleusercontent.com"; // manifest.json의 client_id와 동일
const UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
const FOLDER_ID = "1_Txqyp9l0Mx7tZrEBAoGX_bfXjiD6459"; // 특정 폴더에 저장하려면 폴더 ID를 지정 (선택 사항)

/**
 * 텍스트 내용을 Google Drive에 txt 파일로 업로드하는 함수.
 * @param {string} textContent 저장할 텍스트 내용
 * @param {string} fileName 파일 이름 (예: "변환된_텍스트.txt")
 */
async function uploadTextFile(textContent, fileName) {
  try {
    // 2. chrome.identity API를 사용하여 접근 토큰을 얻습니다.
    const token = await new Promise((resolve, reject) => {
      // interactive: true를 사용해, 토큰이 없을 경우 로그인 팝업을 띄워 사용자에게 인증을 요청합니다.
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        if (!token) {
          return reject(new Error("인증 토큰을 얻지 못했습니다."));
        }
        resolve(token);
      });
    });

    console.log("인증 토큰 획득 완료:", token);

    // 3. Drive API 요청을 위한 데이터 준비 (multipart/form-data)
    const boundary = 'foo_bar_baz'; // 멀티파트 바운더리 문자열
    
    // 파일 메타데이터 (JSON)
    const metadata = {
      name: fileName,
      mimeType: 'text/plain',
      // FOLDER_ID가 설정되어 있으면 해당 폴더에 저장합니다.
      ...(FOLDER_ID && { parents: [FOLDER_ID] })
    };
    // 요청 본문(Body) 구성 - CRLF(\r\n)로 명확히 구분
    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: text/plain\r\n\r\n` +
      `${textContent}\r\n` +
      `--${boundary}--`;

    // 4. Drive API 호출 (파일 업로드)
    const response = await fetch(UPLOAD_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`, // 획득한 토큰을 Authorization 헤더에 사용
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: body
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`파일 업로드 실패: HTTP ${response.status} - ${errorText}`);
    }

    const file = await response.json();
    console.log("파일 업로드 성공. 파일 ID:", file.id);
    // alert(`파일 업로드 성공: ${file.name}\nID: ${file.id}`);

    return file.id;

  } catch (error) {
    console.error("파일 업로드 중 오류 발생:", error);
    // 에러를 호출자에게 전달하여 호출 측에서 처리하도록 함
    throw error;
  }
}

// 5. Chrome Extension Action (아이콘 클릭) 리스너
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "upload_text_to_drive") {
        
        // uploadTextFile 함수를 호출하고 결과를 Content Script로 다시 보냅니다.
        uploadTextFile(request.textContent, request.fileName)
          .then(fileId => {
            if (fileId) {
              sendResponse({ status: "success", fileId: fileId });
            } else {
              console.error("업로드 함수가 성공적으로 끝났지만 fileId가 없습니다.");
              sendResponse({ status: "error", error: "fileId가 반환되지 않았습니다." });
            }
          })
          .catch(error => {
            console.error("uploadTextFile 예외:", error);
            sendResponse({ status: "error", error: (error && error.message) || String(error) });
          });
            
        // 중요: 비동기 응답을 위해 true를 반환해야 Chrome이 응답을 기다립니다.
        return true; 
    }
});
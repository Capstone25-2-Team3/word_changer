// 팝업이 열릴 때 저장된 설정 불러오기
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['blurEnabled', 'softEnabled'], (result) => {
    document.getElementById('blur-toggle').checked = result.blurEnabled || false;
    document.getElementById('soft-toggle').checked = result.softEnabled || false;
  });
});

// Blur 스위치 변경 시 저장
document.getElementById('blur-toggle').addEventListener('change', (e) => {
  const isEnabled = e.target.checked;
  chrome.storage.local.set({ blurEnabled: isEnabled }, () => {
    console.log('Blur 설정 저장됨:', isEnabled);
  });
});

// 순화 스위치 변경 시 저장
document.getElementById('soft-toggle').addEventListener('change', (e) => {
  const isEnabled = e.target.checked;
  chrome.storage.local.set({ softEnabled: isEnabled }, () => {
    console.log('순화 설정 저장됨:', isEnabled);
  });
});


// 기능 추가 : 신고 모드/선택 댓글 미리보기/선택 신고 로직
document.addEventListener('DOMContentLoaded', () => {
  const reportModeToggle = document.getElementById('report-mode-toggle');
  const reportBtn = document.getElementById('report-btn');
  const reportClearBtn = document.getElementById('report-clear-btn');
  const reportStatus = document.getElementById('report-status');
  const reportPreview = document.getElementById('report-preview');

  if (!reportModeToggle || !reportBtn || !reportClearBtn) return;

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('활성 탭을 찾을 수 없습니다.');
    return tab;
  }

  function setPreviewText(selected) {
    if (!selected) {
      reportPreview.textContent = '선택된 댓글이 없습니다.';
      return;
    }
    // 미리보기는 원문/변환문 중 원하는 걸 보여주면 됨(여긴 둘 다)
    reportPreview.textContent =
      `원문:\n${selected.original_text}\n\n순화/변환:\n${selected.transformed_text}`;
  }

  async function refreshSelectedPreview() {
    try {
      const tab = await getActiveTab();
      const resp = await chrome.tabs.sendMessage(tab.id, { action: 'GET_SELECTED_REPORT' });
      setPreviewText(resp?.selected || null);
    } catch (e) {
      // 팝업이 열렸을 때 content script가 아직 준비 안된 경우도 있으니 조용히 처리
      setPreviewText(null);
    }
  }

  // 기능 추가 : 신고 모드 상태 로드 + content로 동기화
  chrome.storage.local.get(['reportModeEnabled'], async (result) => {
    const enabled = result.reportModeEnabled || false;
    reportModeToggle.checked = enabled;

    try {
      const tab = await getActiveTab();
      await chrome.tabs.sendMessage(tab.id, { action: 'SET_REPORT_MODE', enabled });
    } catch (e) {
      // ignore
    }

    refreshSelectedPreview();
  });

  // 기능 추가 : 신고 모드 토글 변경 → storage 저장 + content에 전달
  reportModeToggle.addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    reportStatus.textContent = enabled ? '신고 모드가 켜졌습니다. 문제 댓글을 클릭하세요.' : '신고 모드가 꺼졌습니다.';

    chrome.storage.local.set({ reportModeEnabled: enabled });

    try {
      const tab = await getActiveTab();
      await chrome.tabs.sendMessage(tab.id, { action: 'SET_REPORT_MODE', enabled });
      // 토글 직후 미리보기 갱신
      await refreshSelectedPreview();
    } catch (err) {
      reportStatus.textContent = '실패: ' + err.message;
    }
  });

  // 기능 추가 : 선택 해제 버튼
  reportClearBtn.addEventListener('click', async () => {
    reportStatus.textContent = '';
    try {
      const tab = await getActiveTab();
      await chrome.tabs.sendMessage(tab.id, { action: 'CLEAR_SELECTED_REPORT' });
      setPreviewText(null);
      reportStatus.textContent = '선택이 해제되었습니다.';
    } catch (err) {
      reportStatus.textContent = '실패: ' + err.message;
    }
  });

  // 기능 추가 : “선택 댓글 신고” 버튼 → 선택된 1개만 서버로 전송
  reportBtn.addEventListener('click', async () => {
    reportBtn.disabled = true;
    reportClearBtn.disabled = true;
    reportStatus.textContent = '전송 중...';

    try {
      const tab = await getActiveTab();

      const selectedResp = await chrome.tabs.sendMessage(tab.id, { action: 'GET_SELECTED_REPORT' });
      const selected = selectedResp?.selected;

      if (!selected) {
        throw new Error('선택된 댓글이 없습니다. 신고 모드 ON 후 댓글을 클릭하세요.');
      }

      const payload = {
        comments: [selected],
        extension_version: "1.0",
        report_type: "fine_tuning_collection"
      };

      const response = await chrome.runtime.sendMessage({
        action: 'REPORT_REQUEST',
        url: 'http://localhost:8000/report',
        data: payload
      });

      if (response?.success) {
        reportStatus.textContent = '신고가 성공적으로 전송되었습니다.';
        // 선택을 자동 해제하고 싶으면 아래 2줄 활성화
        // await chrome.tabs.sendMessage(tab.id, { action: 'CLEAR_SELECTED_REPORT' });
        // setPreviewText(null);
      } else {
        throw new Error(response?.error || '전송 실패');
      }

    } catch (error) {
      reportStatus.textContent = '실패: ' + error.message;
    } finally {
      reportBtn.disabled = false;
      reportClearBtn.disabled = false;
      // 전송 후 미리보기 갱신
      refreshSelectedPreview();
    }
  });

  // 기능 추가 : 팝업이 열릴 때마다 미리보기 최신화
  refreshSelectedPreview();
});
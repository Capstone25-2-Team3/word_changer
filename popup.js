// 팝업이 열릴 때 저장된 설정 불러오기
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['blurEnabled', 'softEnabled', 'reportModeEnabled'], (result) => {
    document.getElementById('blur-toggle').checked = result.blurEnabled || false;
    document.getElementById('soft-toggle').checked = result.softEnabled || false;

    // 기능 추가 : 신고 모드 상태 복원
    const reportModeToggle = document.getElementById('report-mode-toggle');
    if (reportModeToggle) {
      reportModeToggle.checked = result.reportModeEnabled || false;
    }
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


// 기능 추가 : 신고 모드 / 단일 선택 신고 / 상세 입력 화면 로직
document.addEventListener('DOMContentLoaded', () => {
  const BASE_API = 'http://13.125.69.33:8080';

  const reportModeToggle = document.getElementById('report-mode-toggle');
  const reportBtn = document.getElementById('report-btn');
  const reportClearBtn = document.getElementById('report-clear-btn');
  const reportStatus = document.getElementById('report-status');
  const reportPreview = document.getElementById('report-preview');

  const mainView = document.getElementById('main-view');
  const detailView = document.getElementById('detail-view');
  const detailProblemText = document.getElementById('detail-problem-text');
  const detailCancelBtn = document.getElementById('detail-cancel-btn');
  const detailSubmitBtn = document.getElementById('detail-submit-btn');
  const detailStatus = document.getElementById('detail-status');

  let currentSelectedReport = null;

  if (!reportModeToggle || !reportBtn || !reportClearBtn || !reportPreview) return;

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('활성 탭을 찾을 수 없습니다.');
    return tab;
  }

  function renderSelectedReport(selectedReport = null) {
    currentSelectedReport = selectedReport;

    if (!selectedReport) {
      reportPreview.textContent = '선택된 댓글이 없습니다.';
      return;
    }

    reportPreview.textContent = selectedReport.transformed_text;
  }

  async function refreshSelectedReport() {
    try {
      const tab = await getActiveTab();
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'GET_SELECTED_REPORT'
      });
      renderSelectedReport(response?.selectedReport || null);
    } catch (error) {
      renderSelectedReport(null);
    }
  }

  function openDetailView() {
    if (!currentSelectedReport) return;
    mainView.classList.add('hidden');
    detailView.classList.remove('hidden');
    detailProblemText.textContent = currentSelectedReport.original_text;
    detailStatus.textContent = '';

    document.querySelectorAll('input[name="report-category"]').forEach(radio => {
      radio.checked = false;
    });
  }

  function closeDetailView() {
    detailView.classList.add('hidden');
    mainView.classList.remove('hidden');
    detailStatus.textContent = '';
  }

  function mapCategoryToLabels(category) {
    switch (category) {
      case '성별 및 성소수자':
        return ['성소수자'];
      case '지역 비하':
        return ['지역'];
      case '위협 및 협박':
        return ['기타 혐오'];
      case '인종 비하':
        return ['인종/국적'];
      case '나이 비하':
        return ['연령'];
      case '종교 비하':
        return ['종교'];
      case '기타':
      default:
        return ['기타 혐오'];
    }
  }

  refreshSelectedReport();

  reportModeToggle.addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    chrome.storage.local.set({ reportModeEnabled: enabled });

    try {
      const tab = await getActiveTab();
      await chrome.tabs.sendMessage(tab.id, {
        action: 'SET_REPORT_MODE',
        enabled
      });

      reportStatus.textContent = enabled
        ? '신고 모드가 켜졌습니다. 페이지에서 체크박스를 선택하세요.'
        : '신고 모드가 꺼졌습니다.';

      refreshSelectedReport();
    } catch (error) {
      reportStatus.textContent = '실패: ' + error.message;
    }
  });

  reportClearBtn.addEventListener('click', async () => {
    try {
      const tab = await getActiveTab();
      await chrome.tabs.sendMessage(tab.id, {
        action: 'CLEAR_SELECTED_REPORT'
      });

      reportStatus.textContent = '선택이 해제되었습니다.';
      renderSelectedReport(null);
    } catch (error) {
      reportStatus.textContent = '실패: ' + error.message;
    }
  });

  // 기능 추가 : 메인 화면의 신고 버튼은 상세 입력 화면 오픈
  reportBtn.addEventListener('click', async () => {
    try {
      await refreshSelectedReport();

      if (!currentSelectedReport) {
        throw new Error('선택된 댓글이 없습니다.');
      }

      openDetailView();
    } catch (error) {
      reportStatus.textContent = '실패: ' + error.message;
    }
  });

  // 기능 추가 : 상세 입력 화면 취소 버튼
  detailCancelBtn.addEventListener('click', () => {
    closeDetailView();
  });

  // 기능 추가 : comments 등록 → reports 등록 순서로 전송
  detailSubmitBtn.addEventListener('click', async () => {
    detailSubmitBtn.disabled = true;
    detailStatus.textContent = '제안 제출 중...';

    try {
      if (!currentSelectedReport) {
        throw new Error('선택된 댓글 정보가 없습니다.');
      }

      const selectedCategory = document.querySelector('input[name="report-category"]:checked')?.value;
      if (!selectedCategory) {
        throw new Error('분류 항목을 선택해주세요.');
      }

      const commentPayload = {
        platform: currentSelectedReport.platform,
        contentUrl: currentSelectedReport.url,
        commentExternalId: currentSelectedReport.comment_id,
        textRaw: currentSelectedReport.original_text,
        textNorm: currentSelectedReport.original_text,
        lang: 'ko'
      };

      const commentResponse = await chrome.runtime.sendMessage({
        action: 'REPORT_REQUEST',
        url: `${BASE_API}/api/comments`,
        data: commentPayload
      });

      if (!commentResponse?.success || !commentResponse?.data?.commentId) {
        throw new Error(commentResponse?.error || '댓글 등록 실패');
      }

      const commentId = commentResponse.data.commentId;

      const reportPayload = {
        commentId: commentId,
        reporterUserId: 'extension_user',
        reportReason: selectedCategory,
        suggestedLabels: mapCategoryToLabels(selectedCategory),
        suggestedClean: false,
        correctedText: currentSelectedReport.transformed_text
      };

      const reportResponse = await chrome.runtime.sendMessage({
        action: 'REPORT_REQUEST',
        url: `${BASE_API}/api/reports`,
        data: reportPayload
      });

      if (!reportResponse?.success) {
        throw new Error(reportResponse?.error || '신고 등록 실패');
      }

      detailStatus.textContent = '제안이 성공적으로 제출되었습니다.';

      const tab = await getActiveTab();
      await chrome.tabs.sendMessage(tab.id, {
        action: 'CLEAR_SELECTED_REPORT'
      });

      renderSelectedReport(null);

      setTimeout(() => {
        closeDetailView();
        reportStatus.textContent = '신고가 성공적으로 제출되었습니다.';
      }, 700);

    } catch (error) {
      detailStatus.textContent = '실패: ' + error.message;
    } finally {
      detailSubmitBtn.disabled = false;
    }
  });
});
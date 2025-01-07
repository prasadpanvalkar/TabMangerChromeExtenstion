document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchInput");
  const tabGroupContainer = document.getElementById("tabGroupContainer");
  const autoGroupBtn = document.getElementById("autoGroupBtn");
  const openOptionsBtn = document.getElementById("openOptionsBtn");

  // Fetch and display tabs grouped by their groups
  async function displayTabs() {
    const tabs = await chrome.tabs.query({});
    const groups = await chrome.tabGroups.query({});
    const groupMap = new Map();

    // Organize tabs into groups
    for (const tab of tabs) {
      const groupId = tab.groupId || "ungrouped";
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, []);
      }
      groupMap.get(groupId).push(tab);
    }

    // Clear previous content
    tabGroupContainer.innerHTML = "";

    // Display tabs in groups
    for (const [groupId, groupTabs] of groupMap.entries()) {
      const groupDiv = document.createElement("div");
      groupDiv.className = "tab-group";

      // Find group title (if grouped)
      const group = groups.find((g) => g.id === groupId);
      const groupTitle = group ? group.title : "Ungrouped Tabs";

      const groupHeader = document.createElement("h3");
      groupHeader.textContent = groupTitle;
      groupDiv.appendChild(groupHeader);

      // Create tab items
      for (const tab of groupTabs) {
        const tabItem = document.createElement("div");
        tabItem.className = "tab-item";

        // Create favicon
        const favicon = document.createElement("img");
        favicon.src = tab.favIconUrl || "default-favicon.png";

        // Create tab title
        const tabTitle = document.createElement("span");
        tabTitle.textContent = tab.title;

        // Add click event to switch to tab
        tabItem.addEventListener("click", () => {
          chrome.tabs.update(tab.id, { active: true });
          window.close(); // Close popup after selecting tab
        });

        tabItem.appendChild(favicon);
        tabItem.appendChild(tabTitle);
        groupDiv.appendChild(tabItem);
      }

      tabGroupContainer.appendChild(groupDiv);
    }
  }

  // Search functionality
  searchInput.addEventListener("input", () => {
    const searchTerm = searchInput.value.toLowerCase();
    const tabItems = document.querySelectorAll(".tab-item");

    tabItems.forEach((item) => {
      const title = item.textContent.toLowerCase();
      item.style.display = title.includes(searchTerm) ? "flex" : "none";
    });
  });

  // Auto group tabs
  autoGroupBtn.addEventListener("click", () => {
    chrome.runtime.getBackgroundPage((backgroundPage) => {
      backgroundPage.backgroundMethods.autoGroupTabs();
      // Refresh tab list
      displayTabs();
    });
  });

  // Open options page
  openOptionsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // Initial display of tabs
  displayTabs();

  // Refresh tabs periodically
  setInterval(displayTabs, 5000);
});

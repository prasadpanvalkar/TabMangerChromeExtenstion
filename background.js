// Tab Grouping Chrome Extension Background Script

// Default grouping rules with improved domain matching
let DEFAULT_RULES = {
  Social Media: [
    "facebook.com",
    "twitter.com",
    "instagram.com",
    "linkedin.com",
    "pinterest.com",
    "tiktok.com",
  ],
  Work Tools: [
    "slack.com",
    "trello.com",
    "asana.com",
    "notion.so",
    "github.com",
    "gitlab.com",
    "figma.com",
  ],
  News: [
    "cnn.com",
    "bbc.com",
    "reuters.com",
    "npr.org",
    "nytimes.com",
    "washingtonpost.com",
  ],
  Entertainment: [
    "youtube.com",
    "netflix.com",
    "hulu.com",
    "spotify.com",
    "twitch.tv",
  ],
};

// Color mapping for tab groups
const GROUP_COLORS = {
  Social Media: "pink",
  Work Tools: "blue",
  News: "green",
  Entertainment: "purple",
  Uncategorized: "grey",
};

/**
 * Initialize storage with default grouping rules
 */
async function initializeStorage() {
  try {
    const storedData = await chrome.storage.sync.get([
      "groupingRules",
      "customGroups",
    ]);

    // Set default rules if not exist
    if (!storedData.groupingRules) {
      await chrome.storage.sync.set({
        groupingRules: DEFAULT_RULES,
        customGroups: [],
      });
      console.log("Default grouping rules and custom groups initialized");
    }
  } catch (error) {
    console.error("Error initializing storage:", error);
  }
}

/**
 * Add a new custom group
 * @param {string} groupName - Name of the new group
 * @param {string[]} domains - Domains to be added to the group
 */
async function addCustomGroup(groupName, domains) {
  try {
    const { groupingRules, customGroups } = await chrome.storage.sync.get([
      "groupingRules",
      "customGroups",
    ]);

    // Ensure group name is unique
    if (
      groupingRules[groupName] ||
      customGroups.some((group) => group.name === groupName)
    ) {
      throw new Error(`Group ${groupName} already exists`);
    }

    // Add to grouping rules
    groupingRules[groupName] = domains;

    // Add to custom groups if not already exists
    const updatedCustomGroups = customGroups || [];
    updatedCustomGroups.push({
      name: groupName,
      domains: domains,
      color: getGroupColor(groupName),
    });

    await chrome.storage.sync.set({
      groupingRules,
      customGroups: updatedCustomGroups,
    });

    console.log(`Custom group ${groupName} added successfully`);
    return true;
  } catch (error) {
    console.error("Error adding custom group:", error);
    return false;
  }
}

/**
 * Determine the group for a given URL
 * @param {string} url - The URL to categorize
 * @returns {Promise<string>} The determined group name
 */
async function determineGroup(url) {
  try {
    const { groupingRules } = await chrome.storage.sync.get("groupingRules");

    // Use URL parsing for more robust domain matching
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.replace(/^www\./, "");

    for (const [group, domains] of Object.entries(groupingRules)) {
      if (domains.some((domain) => hostname.includes(domain))) {
        return group;
      }
    }
    return "Uncategorized";
  } catch (error) {
    console.error("Error determining group:", error);
    return "Uncategorized";
  }
}

/**
 * Get color for a group
 * @param {string} groupName - Name of the group
 * @returns {string} Color for the group
 */
function getGroupColor(groupName) {
  return GROUP_COLORS[groupName] || "grey";
}

/**
 * Automatically group tabs based on their URLs
 */
async function autoGroupTabs() {
  // Ensure chrome.tabGroups and chrome.tabs APIs are available
  if (typeof chrome === "undefined" || !chrome.tabGroups || !chrome.tabs) {
    console.warn("Required Chrome APIs not available");
    return;
  }

  try {
    const tabs = await chrome.tabs.query({});
    const groupMap = {};

    // Categorize tabs into groups
    for (const tab of tabs) {
      if (!tab.url) continue;

      const group = await determineGroup(tab.url);
      groupMap[group] = groupMap[group] || [];
      groupMap[group].push(tab);
    }

    // Create groups and move tabs
    for (const [groupName, groupTabs] of Object.entries(groupMap)) {
      try {
        // Skip if no tabs in the group
        if (groupTabs.length === 0) continue;

        // Group tabs
        const groupId = await chrome.tabs.group({
          tabIds: groupTabs.map((tab) => tab.id),
        });

        // Update group properties
        await chrome.tabGroups.update(groupId, {
          title: groupName,
          color: getGroupColor(groupName),
        });
      } catch (groupError) {
        // Handle potential errors for specific groups
        console.error(`Error creating group ${groupName}:`, groupError);
      }
    }
  } catch (error) {
    console.error("Error in auto-grouping tabs:", error);
  }
}

/**
 * Move Uncategorized tabs to a specific group
 * @param {string} targetGroup - Group to move uncategorized tabs to
 */
async function moveUncategorizedTabs(targetGroup) {
  // Ensure chrome.tabGroups and chrome.tabs APIs are available
  if (typeof chrome === "undefined" || !chrome.tabGroups || !chrome.tabs) {
    console.warn("Required Chrome APIs not available");
    return;
  }

  try {
    const { groupingRules } = await chrome.storage.sync.get("groupingRules");

    // Ensure target group exists in rules
    if (!groupingRules[targetGroup]) {
      console.error(`Target group ${targetGroup} does not exist`);
      return;
    }

    // Get all uncategorized tabs
    const uncategorizedTabs = await chrome.tabs.query({});
    const tabsToMove = [];

    // Filter tabs to move
    for (const tab of uncategorizedTabs) {
      if (!tab.url) continue;

      const currentGroup = await determineGroup(tab.url);
      if (currentGroup === "Uncategorized") {
        tabsToMove.push(tab);

        // Optionally update the domain list for the target group
        const parsedUrl = new URL(tab.url);
        const hostname = parsedUrl.hostname.replace(/^www\./, "");

        if (!groupingRules[targetGroup].includes(hostname)) {
          groupingRules[targetGroup].push(hostname);
        }
      }
    }

    // Update grouping rules if domains were added
    await chrome.storage.sync.set({ groupingRules });

    // Group tabs if any are found
    if (tabsToMove.length > 0) {
      const groupId = await chrome.tabs.group({
        tabIds: tabsToMove.map((tab) => tab.id),
      });

      await chrome.tabGroups.update(groupId, {
        title: targetGroup,
        color: getGroupColor(targetGroup),
      });

      console.log(
        `Moved ${tabsToMove.length} uncategorized tabs to ${targetGroup}`
      );
    }
  } catch (error) {
    console.error("Error moving uncategorized tabs:", error);
  }
}

/**
 * Cycle through tab groups
 */
async function cycleTabGroups() {
  // Ensure chrome.tabGroups and chrome.tabs APIs are available
  if (typeof chrome === "undefined" || !chrome.tabGroups || !chrome.tabs) {
    console.warn("Required Chrome APIs not available");
    return;
  }

  try {
    const groups = await chrome.tabGroups.query({});
    if (groups.length === 0) return;

    // Find current active tab's group
    const [currentTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    const currentGroupIndex = currentTab.groupId
      ? groups.findIndex((g) => g.id === currentTab.groupId)
      : -1;

    // Determine next group index
    const nextIndex =
      currentGroupIndex >= 0 ? (currentGroupIndex + 1) % groups.length : 0;

    const nextGroup = groups[nextIndex];
    const groupTabs = await chrome.tabs.query({ groupId: nextGroup.id });

    // Activate first tab in the next group
    if (groupTabs.length > 0) {
      await chrome.tabs.update(groupTabs[0].id, { active: true });
    }
  } catch (error) {
    console.error("Error cycling through tab groups:", error);
  }
}

/**
 * Navigate to next tab within the current group
 */
async function navigateWithinGroup() {
  // Ensure chrome.tabs API is available
  if (typeof chrome === "undefined" || !chrome.tabs) {
    console.warn("Required Chrome APIs not available");
    return;
  }

  try {
    const [currentTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!currentTab.groupId) return;

    const groupTabs = await chrome.tabs.query({
      groupId: currentTab.groupId,
    });

    if (groupTabs.length <= 1) return;

    const currentIndex = groupTabs.findIndex((tab) => tab.id === currentTab.id);
    const nextIndex = (currentIndex + 1) % groupTabs.length;

    await chrome.tabs.update(groupTabs[nextIndex].id, { active: true });
  } catch (error) {
    console.error("Error navigating within group:", error);
  }
}

// Ensure all code runs in an async context
(async () => {
  // Keyboard shortcut listeners
  chrome.commands.onCommand.addListener((command) => {
    switch (command) {
      case "cycle-tab-groups":
        cycleTabGroups();
        break;
      case "navigate-within-group":
        navigateWithinGroup();
        break;
      case "move-uncategorized":
        moveUncategorizedTabs("Work Tools"); // Default target group
        break;
    }
  });

  // Extension installation handler
  chrome.runtime.onInstalled.addListener(async () => {
    await initializeStorage();
    await autoGroupTabs();
    console.log("Extension installed and initialized");
  });

  // Initialize storage on script load
  await initializeStorage();
})();

// Expose functions for potential use in popup or options page
window.tabGroupingExtension = {
  addCustomGroup,
  moveUncategorizedTabs,
  autoGroupTabs,
};

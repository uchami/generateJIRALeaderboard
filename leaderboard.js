const axios = require('axios');
const base64 = require('base-64');

// Replace these with your actual values
const email = '<email>';
const apiToken = '<token>';

const jql = encodeURIComponent(`
  project = RD AND
  sprint in openSprints() AND
  type in ("Task", "Story", "Bug") AND
  assignee != "Uriel Chami"
`);

const fields = ['status', 'assignee', 'timetracking', 'sprint'].join(',');
const maxResults = 100;

const url = `https://therayapp.atlassian.net/rest/api/3/search?maxResults=${maxResults}&jql=${jql}&fields=${fields}`;
const urlSprintDetails = `https://therayapp.atlassian.net/rest/agile/1.0/sprint/1000`
const auth = base64.encode(`${email}:${apiToken}`);
// const doneStatuses = ['In review', 'Merged', 'In Progress'];
const doneStatuses = ['In review', 'Merged'];
axios.get(url, {
  headers: {
    'Authorization': `Basic ${auth}`,
    'Accept': 'application/json'
  }
})
.then(response => {
  const sprintDetails = { totalEffort: 0, completedEffort: 0, name: '' };
  const assigneesData = {};
  response.data.issues.forEach(issue => {
    if (!issue.fields.assignee || issue.fields.assignee.displayName === 'Uriel Chami') {
      return; // Skip if no assignee or if assignee is Uriel Chami
    }

    const assigneeName = issue.fields.assignee.displayName;
    const originalEstimateSeconds = issue.fields.timetracking?.originalEstimateSeconds || 0;
    const status = issue.fields.status.name;

    if (!assigneesData[assigneeName]) {
      assigneesData[assigneeName] = {
        completedEffort: 0,
        totalEffort: 0,
        name: assigneeName
      };
    }

    assigneesData[assigneeName].totalEffort += originalEstimateSeconds;
    sprintDetails.totalEffort += originalEstimateSeconds;

    if (doneStatuses.includes(status)) {
      assigneesData[assigneeName].completedEffort += originalEstimateSeconds;
      sprintDetails.completedEffort += originalEstimateSeconds;
    }
  });

  // Convert assigneesData object to an array for sorting
  const leaderboard = Object.values(assigneesData);

  // Calculate percentage and sort
  leaderboard.forEach(assignee => {
    assignee.percentage = assignee.totalEffort > 0 ? (assignee.completedEffort / assignee.totalEffort) * 100 : 0;
  });

  leaderboard.sort((a, b) => b.percentage - a.percentage);

  // Helper function to format seconds into weeks, days, hours
  function formatTime(seconds) {
    if (seconds === 0) return "0h";
    const SECONDS_IN_MINUTE = 60;
    const SECONDS_IN_HOUR = SECONDS_IN_MINUTE * 60;
    const SECONDS_IN_DAY = SECONDS_IN_HOUR * 8; // Assuming 8-hour work day
    const SECONDS_IN_WEEK = SECONDS_IN_DAY * 5; // Assuming 5-day work week

    let remainingSeconds = seconds;
    const weeks = Math.floor(remainingSeconds / SECONDS_IN_WEEK);
    remainingSeconds %= SECONDS_IN_WEEK;
    const days = Math.floor(remainingSeconds / SECONDS_IN_DAY);
    remainingSeconds %= SECONDS_IN_DAY;
    const hours = Math.floor(remainingSeconds / SECONDS_IN_HOUR);

    let parts = [];
    if (weeks > 0) parts.push(`${weeks}w`);
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    
    return parts.length > 0 ? parts.join(' ') : '0h';
  }

  // Generate the leaderboard string
  if (leaderboard.length > 0) {
    let leaderboardString = `El MVP de este sprint es: ${leaderboard[0].name}! 🎉\n`;
    leaderboardString += "Leaderboard de tickets de este sprint en Desarrollo 🏆:\n";
    leaderboard.forEach((assignee, index) => {
      leaderboardString += `${index + 1}) ${assignee.name} - ${assignee.percentage.toFixed(1)}% de esfuerzo completado este sprint (${formatTime(assignee.completedEffort)} / ${formatTime(assignee.totalEffort)}).\n`;
    });
    leaderboardString += `\nEsfuerzo estimado vs completado del sprint: ${formatTime(sprintDetails.totalEffort)} / ${formatTime(sprintDetails.completedEffort)}.\n`;
    const completedPercentage = (sprintDetails.completedEffort / sprintDetails.totalEffort * 100).toFixed(1);
    if(completedPercentage < 90) {
      leaderboardString += `Un ${completedPercentage}% de esfuerzo completado. No se cumplió con el objetivo de este sprint. 🤔\n`;
    } else {
      leaderboardString += `Un ${completedPercentage}% de esfuerzo completado. Cumplimos el objetivo de este sprint. 🎉\n`;
    }
    if(doneStatuses.includes("In Progress")) {
      leaderboardString += "Considerando los tickets in progress como done 👀\n";
    }
    console.log(leaderboardString);
  } else {
    console.log("No data available to generate leaderboard.");
  }

})
.catch(error => {
  console.error('Error fetching from Jira:', error.response?.data || error.message);
});
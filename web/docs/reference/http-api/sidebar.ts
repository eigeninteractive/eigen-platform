import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebar: SidebarsConfig = {
  apisidebar: [
    {
      type: "doc",
      id: "reference/http-api/eigeninteractive-engine-api",
    },
    {
      type: "category",
      label: "Games",
      link: {
        type: "doc",
        id: "reference/http-api/games",
      },
      items: [
        {
          type: "doc",
          id: "reference/http-api/get-capabilities",
          label: "getCapabilities",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "reference/http-api/get-lobby",
          label: "getLobby",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "reference/http-api/get-my-games",
          label: "getMyGames",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "reference/http-api/get-game",
          label: "getGame",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "reference/http-api/get-game-session",
          label: "getGameSession",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "reference/http-api/create-game",
          label: "createGame",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "reference/http-api/create-solo-game",
          label: "createSoloGame",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "reference/http-api/join-game",
          label: "joinGame",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "reference/http-api/join-game-by-code",
          label: "joinGameByCode",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "reference/http-api/leave-game",
          label: "leaveGame",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "reference/http-api/cancel-game",
          label: "cancelGame",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "reference/http-api/add-bot",
          label: "addBot",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "reference/http-api/start-game",
          label: "startGame",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "reference/http-api/submit-action",
          label: "submitAction",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "reference/http-api/forfeit-game",
          label: "forfeitGame",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "reference/http-api/get-frames",
          label: "getFrames",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "Me",
      link: {
        type: "doc",
        id: "reference/http-api/me",
      },
      items: [
        {
          type: "doc",
          id: "reference/http-api/get-profile",
          label: "getProfile",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "reference/http-api/delete-account",
          label: "deleteAccount",
          className: "api-method delete",
        },
        {
          type: "doc",
          id: "reference/http-api/get-my-ratings",
          label: "getMyRatings",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "reference/http-api/get-my-rating-history",
          label: "getMyRatingHistory",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "reference/http-api/update-username",
          label: "updateUsername",
          className: "api-method put",
        },
        {
          type: "doc",
          id: "reference/http-api/update-display-name",
          label: "updateDisplayName",
          className: "api-method put",
        },
        {
          type: "doc",
          id: "reference/http-api/register-device",
          label: "registerDevice",
          className: "api-method put",
        },
        {
          type: "doc",
          id: "reference/http-api/unregister-device",
          label: "unregisterDevice",
          className: "api-method delete",
        },
      ],
    },
    {
      type: "category",
      label: "Players",
      link: {
        type: "doc",
        id: "reference/http-api/players",
      },
      items: [
        {
          type: "doc",
          id: "reference/http-api/get-players",
          label: "getPlayers",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "reference/http-api/get-player-games",
          label: "getPlayerGames",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "reference/http-api/get-player-ratings",
          label: "getPlayerRatings",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "Social",
      link: {
        type: "doc",
        id: "reference/http-api/social",
      },
      items: [
        {
          type: "doc",
          id: "reference/http-api/list-friends",
          label: "listFriends",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "reference/http-api/list-friend-requests",
          label: "listFriendRequests",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "reference/http-api/send-friend-request",
          label: "sendFriendRequest",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "reference/http-api/get-friends-games",
          label: "getFriendsGames",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "reference/http-api/search-users",
          label: "searchUsers",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "reference/http-api/accept-friend-request",
          label: "acceptFriendRequest",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "reference/http-api/remove-friend",
          label: "removeFriend",
          className: "api-method delete",
        },
        {
          type: "doc",
          id: "reference/http-api/block-user",
          label: "blockUser",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "reference/http-api/unblock-user",
          label: "unblockUser",
          className: "api-method delete",
        },
      ],
    },
    {
      type: "category",
      label: "Bots",
      link: {
        type: "doc",
        id: "reference/http-api/bots",
      },
      items: [
        {
          type: "doc",
          id: "reference/http-api/get-bots",
          label: "getBots",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "BotWebhook",
      link: {
        type: "doc",
        id: "reference/http-api/bot-webhook",
      },
      items: [
        {
          type: "doc",
          id: "reference/http-api/bot-action",
          label: "botAction",
          className: "api-method post",
        },
      ],
    },
    {
      type: "category",
      label: "Health",
      link: {
        type: "doc",
        id: "reference/http-api/health",
      },
      items: [
        {
          type: "doc",
          id: "reference/http-api/get-health",
          label: "Liveness probe",
          className: "api-method get",
        },
      ],
    },
  ],
};

export default sidebar.apisidebar;

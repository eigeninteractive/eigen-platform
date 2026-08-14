# eigen_api.api.GamesApi

## Load the API package
```dart
import 'package:eigen_api/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**addBot**](GamesApi.md#addbot) | **POST** /api/engine/games/{gameId}/add-bot | 
[**cancelGame**](GamesApi.md#cancelgame) | **POST** /api/engine/games/{gameId}/cancel | 
[**createGame**](GamesApi.md#creategame) | **POST** /api/engine/games | 
[**createSoloGame**](GamesApi.md#createsologame) | **POST** /api/engine/games/solo | 
[**forfeitGame**](GamesApi.md#forfeitgame) | **POST** /api/engine/games/{gameId}/forfeit | 
[**getFrames**](GamesApi.md#getframes) | **GET** /api/engine/games/{gameId}/frames | 
[**getGame**](GamesApi.md#getgame) | **GET** /api/engine/games/{gameId} | 
[**getGameSession**](GamesApi.md#getgamesession) | **GET** /api/engine/games/{gameId}/session | 
[**getLobby**](GamesApi.md#getlobby) | **GET** /api/engine/lobby | 
[**getMyGames**](GamesApi.md#getmygames) | **GET** /api/engine/games/mine | 
[**joinGame**](GamesApi.md#joingame) | **POST** /api/engine/games/{gameId}/join | 
[**joinGameByCode**](GamesApi.md#joingamebycode) | **POST** /api/engine/games/join-by-code | 
[**leaveGame**](GamesApi.md#leavegame) | **POST** /api/engine/games/{gameId}/leave | 
[**startGame**](GamesApi.md#startgame) | **POST** /api/engine/games/{gameId}/start | 
[**submitAction**](GamesApi.md#submitaction) | **POST** /api/engine/games/{gameId}/action | 


# **addBot**
> CommandAccepted addBot(gameId, idempotencyKey, addBot)



### Example
```dart
import 'package:eigen_api/api.dart';

final api = EigenApi().getGamesApi();
final String gameId = gameId_example; // String | 
final String idempotencyKey = 0199a4e0-8f7b-7c3a-b2d5-6894a57f9324; // String | Stable id for this logical intent, reused unchanged on every retry. A UUIDv7 is recommended. Reusing one for a different request is rejected with `commandConflict`.
final AddBot addBot = ; // AddBot | 

try {
    final response = api.addBot(gameId, idempotencyKey, addBot);
    print(response);
} catch on DioException (e) {
    print('Exception when calling GamesApi->addBot: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **gameId** | **String**|  | 
 **idempotencyKey** | **String**| Stable id for this logical intent, reused unchanged on every retry. A UUIDv7 is recommended. Reusing one for a different request is rejected with `commandConflict`. | 
 **addBot** | [**AddBot**](AddBot.md)|  | 

### Return type

[**CommandAccepted**](CommandAccepted.md)

### Authorization

[firebase](../README.md#firebase)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **cancelGame**
> CommandAccepted cancelGame(gameId, idempotencyKey)



### Example
```dart
import 'package:eigen_api/api.dart';

final api = EigenApi().getGamesApi();
final String gameId = gameId_example; // String | 
final String idempotencyKey = 0199a4e0-8f7b-7c3a-b2d5-6894a57f9324; // String | Stable id for this logical intent, reused unchanged on every retry. A UUIDv7 is recommended. Reusing one for a different request is rejected with `commandConflict`.

try {
    final response = api.cancelGame(gameId, idempotencyKey);
    print(response);
} catch on DioException (e) {
    print('Exception when calling GamesApi->cancelGame: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **gameId** | **String**|  | 
 **idempotencyKey** | **String**| Stable id for this logical intent, reused unchanged on every retry. A UUIDv7 is recommended. Reusing one for a different request is rejected with `commandConflict`. | 

### Return type

[**CommandAccepted**](CommandAccepted.md)

### Authorization

[firebase](../README.md#firebase)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createGame**
> Created createGame(idempotencyKey, createGame)



### Example
```dart
import 'package:eigen_api/api.dart';

final api = EigenApi().getGamesApi();
final String idempotencyKey = 0199a4e0-8f7b-7c3a-b2d5-6894a57f9324; // String | Stable id for this logical intent, reused unchanged on every retry. A UUIDv7 is recommended. Reusing one for a different request is rejected with `commandConflict`.
final CreateGame createGame = ; // CreateGame | 

try {
    final response = api.createGame(idempotencyKey, createGame);
    print(response);
} catch on DioException (e) {
    print('Exception when calling GamesApi->createGame: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **idempotencyKey** | **String**| Stable id for this logical intent, reused unchanged on every retry. A UUIDv7 is recommended. Reusing one for a different request is rejected with `commandConflict`. | 
 **createGame** | [**CreateGame**](CreateGame.md)|  | 

### Return type

[**Created**](Created.md)

### Authorization

[firebase](../README.md#firebase)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createSoloGame**
> SoloStarted createSoloGame(idempotencyKey, createSolo)



### Example
```dart
import 'package:eigen_api/api.dart';

final api = EigenApi().getGamesApi();
final String idempotencyKey = 0199a4e0-8f7b-7c3a-b2d5-6894a57f9324; // String | Stable id for this logical intent, reused unchanged on every retry. A UUIDv7 is recommended. Reusing one for a different request is rejected with `commandConflict`.
final CreateSolo createSolo = ; // CreateSolo | 

try {
    final response = api.createSoloGame(idempotencyKey, createSolo);
    print(response);
} catch on DioException (e) {
    print('Exception when calling GamesApi->createSoloGame: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **idempotencyKey** | **String**| Stable id for this logical intent, reused unchanged on every retry. A UUIDv7 is recommended. Reusing one for a different request is rejected with `commandConflict`. | 
 **createSolo** | [**CreateSolo**](CreateSolo.md)|  | 

### Return type

[**SoloStarted**](SoloStarted.md)

### Authorization

[firebase](../README.md#firebase)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **forfeitGame**
> CommandAccepted forfeitGame(gameId, idempotencyKey, forfeit)



### Example
```dart
import 'package:eigen_api/api.dart';

final api = EigenApi().getGamesApi();
final String gameId = gameId_example; // String | 
final String idempotencyKey = 0199a4e0-8f7b-7c3a-b2d5-6894a57f9324; // String | Stable id for this logical intent, reused unchanged on every retry. A UUIDv7 is recommended. Reusing one for a different request is rejected with `commandConflict`.
final Forfeit forfeit = ; // Forfeit | 

try {
    final response = api.forfeitGame(gameId, idempotencyKey, forfeit);
    print(response);
} catch on DioException (e) {
    print('Exception when calling GamesApi->forfeitGame: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **gameId** | **String**|  | 
 **idempotencyKey** | **String**| Stable id for this logical intent, reused unchanged on every retry. A UUIDv7 is recommended. Reusing one for a different request is rejected with `commandConflict`. | 
 **forfeit** | [**Forfeit**](Forfeit.md)|  | 

### Return type

[**CommandAccepted**](CommandAccepted.md)

### Authorization

[firebase](../README.md#firebase)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getFrames**
> Frames getFrames(gameId, from, to)



### Example
```dart
import 'package:eigen_api/api.dart';

final api = EigenApi().getGamesApi();
final String gameId = gameId_example; // String | 
final int from = 56; // int | 
final int to = 56; // int | 

try {
    final response = api.getFrames(gameId, from, to);
    print(response);
} catch on DioException (e) {
    print('Exception when calling GamesApi->getFrames: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **gameId** | **String**|  | 
 **from** | **int**|  | [optional] [default to 0]
 **to** | **int**|  | [optional] 

### Return type

[**Frames**](Frames.md)

### Authorization

[firebase](../README.md#firebase)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getGame**
> GameSummary getGame(gameId)



### Example
```dart
import 'package:eigen_api/api.dart';

final api = EigenApi().getGamesApi();
final String gameId = gameId_example; // String | 

try {
    final response = api.getGame(gameId);
    print(response);
} catch on DioException (e) {
    print('Exception when calling GamesApi->getGame: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **gameId** | **String**|  | 

### Return type

[**GameSummary**](GameSummary.md)

### Authorization

[firebase](../README.md#firebase)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getGameSession**
> Session getGameSession(gameId)



### Example
```dart
import 'package:eigen_api/api.dart';

final api = EigenApi().getGamesApi();
final String gameId = gameId_example; // String | 

try {
    final response = api.getGameSession(gameId);
    print(response);
} catch on DioException (e) {
    print('Exception when calling GamesApi->getGameSession: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **gameId** | **String**|  | 

### Return type

[**Session**](Session.md)

### Authorization

[firebase](../README.md#firebase)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getLobby**
> Lobby getLobby(limit, cursor)



### Example
```dart
import 'package:eigen_api/api.dart';

final api = EigenApi().getGamesApi();
final int limit = 56; // int | 
final String cursor = cursor_example; // String | 

try {
    final response = api.getLobby(limit, cursor);
    print(response);
} catch on DioException (e) {
    print('Exception when calling GamesApi->getLobby: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **limit** | **int**|  | [optional] [default to 20]
 **cursor** | **String**|  | [optional] 

### Return type

[**Lobby**](Lobby.md)

### Authorization

[firebase](../README.md#firebase)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getMyGames**
> MyGames getMyGames(bucket, limit, cursor)



### Example
```dart
import 'package:eigen_api/api.dart';

final api = EigenApi().getGamesApi();
final String bucket = bucket_example; // String | 
final int limit = 56; // int | 
final String cursor = cursor_example; // String | 

try {
    final response = api.getMyGames(bucket, limit, cursor);
    print(response);
} catch on DioException (e) {
    print('Exception when calling GamesApi->getMyGames: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bucket** | **String**|  | [optional] [default to 'active']
 **limit** | **int**|  | [optional] [default to 20]
 **cursor** | **String**|  | [optional] 

### Return type

[**MyGames**](MyGames.md)

### Authorization

[firebase](../README.md#firebase)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **joinGame**
> CommandAccepted joinGame(gameId, idempotencyKey, join)



### Example
```dart
import 'package:eigen_api/api.dart';

final api = EigenApi().getGamesApi();
final String gameId = gameId_example; // String | 
final String idempotencyKey = 0199a4e0-8f7b-7c3a-b2d5-6894a57f9324; // String | Stable id for this logical intent, reused unchanged on every retry. A UUIDv7 is recommended. Reusing one for a different request is rejected with `commandConflict`.
final Join join = ; // Join | 

try {
    final response = api.joinGame(gameId, idempotencyKey, join);
    print(response);
} catch on DioException (e) {
    print('Exception when calling GamesApi->joinGame: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **gameId** | **String**|  | 
 **idempotencyKey** | **String**| Stable id for this logical intent, reused unchanged on every retry. A UUIDv7 is recommended. Reusing one for a different request is rejected with `commandConflict`. | 
 **join** | [**Join**](Join.md)|  | 

### Return type

[**CommandAccepted**](CommandAccepted.md)

### Authorization

[firebase](../README.md#firebase)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **joinGameByCode**
> CommandAccepted joinGameByCode(idempotencyKey, joinByCode)



### Example
```dart
import 'package:eigen_api/api.dart';

final api = EigenApi().getGamesApi();
final String idempotencyKey = 0199a4e0-8f7b-7c3a-b2d5-6894a57f9324; // String | Stable id for this logical intent, reused unchanged on every retry. A UUIDv7 is recommended. Reusing one for a different request is rejected with `commandConflict`.
final JoinByCode joinByCode = ; // JoinByCode | 

try {
    final response = api.joinGameByCode(idempotencyKey, joinByCode);
    print(response);
} catch on DioException (e) {
    print('Exception when calling GamesApi->joinGameByCode: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **idempotencyKey** | **String**| Stable id for this logical intent, reused unchanged on every retry. A UUIDv7 is recommended. Reusing one for a different request is rejected with `commandConflict`. | 
 **joinByCode** | [**JoinByCode**](JoinByCode.md)|  | 

### Return type

[**CommandAccepted**](CommandAccepted.md)

### Authorization

[firebase](../README.md#firebase)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **leaveGame**
> CommandAccepted leaveGame(gameId, idempotencyKey)



### Example
```dart
import 'package:eigen_api/api.dart';

final api = EigenApi().getGamesApi();
final String gameId = gameId_example; // String | 
final String idempotencyKey = 0199a4e0-8f7b-7c3a-b2d5-6894a57f9324; // String | Stable id for this logical intent, reused unchanged on every retry. A UUIDv7 is recommended. Reusing one for a different request is rejected with `commandConflict`.

try {
    final response = api.leaveGame(gameId, idempotencyKey);
    print(response);
} catch on DioException (e) {
    print('Exception when calling GamesApi->leaveGame: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **gameId** | **String**|  | 
 **idempotencyKey** | **String**| Stable id for this logical intent, reused unchanged on every retry. A UUIDv7 is recommended. Reusing one for a different request is rejected with `commandConflict`. | 

### Return type

[**CommandAccepted**](CommandAccepted.md)

### Authorization

[firebase](../README.md#firebase)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **startGame**
> CommandAccepted startGame(gameId, idempotencyKey)



### Example
```dart
import 'package:eigen_api/api.dart';

final api = EigenApi().getGamesApi();
final String gameId = gameId_example; // String | 
final String idempotencyKey = 0199a4e0-8f7b-7c3a-b2d5-6894a57f9324; // String | Stable id for this logical intent, reused unchanged on every retry. A UUIDv7 is recommended. Reusing one for a different request is rejected with `commandConflict`.

try {
    final response = api.startGame(gameId, idempotencyKey);
    print(response);
} catch on DioException (e) {
    print('Exception when calling GamesApi->startGame: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **gameId** | **String**|  | 
 **idempotencyKey** | **String**| Stable id for this logical intent, reused unchanged on every retry. A UUIDv7 is recommended. Reusing one for a different request is rejected with `commandConflict`. | 

### Return type

[**CommandAccepted**](CommandAccepted.md)

### Authorization

[firebase](../README.md#firebase)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **submitAction**
> CommandAccepted submitAction(gameId, idempotencyKey, action)



### Example
```dart
import 'package:eigen_api/api.dart';

final api = EigenApi().getGamesApi();
final String gameId = gameId_example; // String | 
final String idempotencyKey = 0199a4e0-8f7b-7c3a-b2d5-6894a57f9324; // String | Stable id for this logical intent, reused unchanged on every retry. A UUIDv7 is recommended. Reusing one for a different request is rejected with `commandConflict`.
final Action action = ; // Action | 

try {
    final response = api.submitAction(gameId, idempotencyKey, action);
    print(response);
} catch on DioException (e) {
    print('Exception when calling GamesApi->submitAction: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **gameId** | **String**|  | 
 **idempotencyKey** | **String**| Stable id for this logical intent, reused unchanged on every retry. A UUIDv7 is recommended. Reusing one for a different request is rejected with `commandConflict`. | 
 **action** | [**Action**](Action.md)|  | 

### Return type

[**CommandAccepted**](CommandAccepted.md)

### Authorization

[firebase](../README.md#firebase)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


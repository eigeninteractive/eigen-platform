# eigen_api.model.Bot

## Load the model package
```dart
import 'package:eigen_api/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **String** |  | 
**username** | **String** |  | 
**displayName** | **String** |  | 
**avatarUrl** | **String** |  | 
**schemaVersion** | **int** |  | 
**type** | [**BotType**](BotType.md) |  | 
**ratedEligible** | **bool** |  | 
**config** | **Object** |  | 
**tier** | **String** | The commercial tier this bot is sold under, when the deployment sells one. Absent means the base `bot.use` capability covers seating it. Never present on a `local` bot, which the server never seats. Presentation only: the server checks access when it seats the bot. | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)



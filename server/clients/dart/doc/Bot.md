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
**tier** | **String** | The commercial tier this bot belongs to: its `botTiers` entry, or `standard`. A `local` bot is always `standard`, because the server never seats it. Presentation only: the server checks access when it seats the bot. | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)



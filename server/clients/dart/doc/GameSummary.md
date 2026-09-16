# eigen_api.model.GameSummary

## Load the model package
```dart
import 'package:eigen_api/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **String** |  | 
**seq** | **int** | The game's revision: the same per-game counter a `Session` carries as `seq`, as of the commit this summary reflects. A client holding a game from several sources keeps whichever copy has the higher `seq`. | 
**createdBy** | **String** |  | 
**status** | [**GameStatus**](GameStatus.md) |  | 
**access** | [**GameAccess**](GameAccess.md) |  | 
**origin** | [**GameOrigin**](GameOrigin.md) |  | 
**schemaVersion** | **int** |  | 
**config** | **Object** |  | 
**turnSeconds** | **int** |  | 
**budgetSeconds** | **int** |  | 
**incrementSeconds** | **int** |  | 
**rated** | **bool** |  | 
**ratingPool** | **String** |  | 
**minPlayers** | **int** |  | 
**maxPlayers** | **int** |  | 
**shortCode** | **String** |  | 
**pendingPlayers** | **List&lt;int&gt;** |  | 
**turnDeadline** | **int** |  | 
**outcomes** | [**List&lt;Outcome&gt;**](Outcome.md) |  | 
**ratings** | [**List&lt;RatingDelta&gt;**](RatingDelta.md) |  | [optional] 
**finishedAt** | **int** |  | 
**createdAt** | **int** |  | 
**updatedAt** | **int** |  | 
**participants** | [**List&lt;Seat&gt;**](Seat.md) |  | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)



# eigen_api.model.AccountSync

## Load the model package
```dart
import 'package:eigen_api/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**account** | [**Profile**](Profile.md) |  | 
**ratings** | [**List&lt;Rating&gt;**](Rating.md) | Every pool the caller is rated in. Whole. | 
**friends** | [**List&lt;Friend&gt;**](Friend.md) | Accepted friends. Whole: an absent friend was removed. | 
**friendRequests** | [**List&lt;FriendRequest&gt;**](FriendRequest.md) | Pending requests in both directions. Whole. | 
**activeGames** | [**List&lt;GameSummary&gt;**](GameSummary.md) | Every game the caller is seated in that has not ended. Whole: a game absent here has ended or the caller left it. | 
**finishedGames** | [**List&lt;GameSummary&gt;**](GameSummary.md) | With `finishedAfter`: the caller's games whose finish committed after that cursor, in commit order. Without it: the newest page of the caller's history, newest first. | 
**players** | [**List&lt;Player&gt;**](Player.md) | The identity of every human seated in the games above. | 
**finishedCursor** | **int** | Pass as `finishedAfter` on the next sync. | 
**hasMoreFinished** | **bool** | More of the increment remains; sync again with `finishedCursor` straight away. | 
**historyFloor** | **String** | Only on a sync without `finishedAfter`: pass as `cursor` to `getMyFinishedGames` for history older than `finishedGames`. Null when that page was the whole history, and always null on an incremental sync. | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)



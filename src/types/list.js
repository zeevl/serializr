import { SKIP } from "../constants"
import {
    invariant,
    isPropSchema,
    isAliasedPropSchema,
    parallel,
    processAdditionalPropArgs
} from "../utils/utils"
import { onAfterDeserialize, onBeforeDeserialize } from "../core/deserialize"
import { _defaultPrimitiveProp } from "../constants"


/**
 * List indicates that this property contains a list of things.
 * Accepts a sub model schema to serialize the contents
 *
 * @example
 * class SubTask {}
 * class Task {}
 * class Todo {}
 *
 * createModelSchema(SubTask, {
 *     title: true,
 * });
 * createModelSchema(Todo, {
 *     title: true,
 *     subTask: list(object(SubTask)),
 * });
 *
 * const todo = deserialize(Todo, {
 *     title: 'Task',
 *     subTask: [
 *         {
 *             title: 'Sub task 1',
 *         },
 *     ],
 * });
 *
 * @param {PropSchema} propSchema to be used to (de)serialize the contents of the array
 * @param {AdditionalPropArgs} additionalArgs optional object that contains beforeDeserialize and/or afterDeserialize handlers
 * @returns {PropSchema}
 */
export default function list(propSchema, additionalArgs) {
    propSchema = propSchema || _defaultPrimitiveProp
    invariant(isPropSchema(propSchema), "expected prop schema as first argument")
    invariant(!isAliasedPropSchema(propSchema),
        "provided prop is aliased, please put aliases first")
    var result = {
        serializer: function (ar) {
            if (ar === undefined) {
                return SKIP
            }
            invariant(ar && "length" in ar && "map" in ar, "expected array (like) object")
            return ar.map(propSchema.serializer)
        },
        deserializer: function (jsonArray, done, context) {
            if (!Array.isArray(jsonArray))
                return void done("[serializr] expected JSON array")

            function processItem(jsonValue, onItemDone, itemIndex) {
                function callbackBefore(err, value) {
                    if (!err) {
                        propSchema.deserializer(value, deserializeDone, context)
                    } else {
                        onItemDone(err)
                    }
                }

                function deserializeDone(err, value) {
                    if (typeof propSchema.afterDeserialize === "function") {
                        onAfterDeserialize(callbackAfter, err, value, jsonValue, itemIndex, context,
                            propSchema)
                    } else {
                        onItemDone(err, value)
                    }
                }

                function callbackAfter(errPreliminary, finalOrRetryValue) {
                    if (errPreliminary && finalOrRetryValue !== undefined &&
                        typeof propSchema.afterDeserialize === "function") {

                        propSchema.deserializer(
                            finalOrRetryValue,
                            deserializeDone,
                            context
                        )
                    } else {
                        onItemDone(errPreliminary, finalOrRetryValue)
                    }
                }

                onBeforeDeserialize(callbackBefore, jsonValue, jsonArray, itemIndex, context,
                    propSchema)
            }

            parallel(
                jsonArray,
                processItem,
                done
            )
        }
    }
    result = processAdditionalPropArgs(result, additionalArgs)
    return result
}
